#!/usr/bin/env python3
"""
GSF-Investor Phase 2 — daily_sec.py
=====================================
매일 KST 07:30 (UTC 22:30 전날) daily_dart.py 직후 GitHub Actions 크론으로 실행.

수집 대상:
  - DB의 활성 종목(is_active=1, sec_cik IS NOT NULL, market='US')
  - SEC EDGAR EFTS API: 최근 10-Q/10-K 제출 목록

동작:
  1. Turso DB에서 활성 미국 종목(sec_cik 보유) 조회
  2. SEC EDGAR submissions API로 최근 제출 목록 수집
  3. 10-Q/10-K만 필터링 → disclosures 테이블에 INSERT OR IGNORE
  4. 결과 요약 출력

환경변수 (GitHub Secrets):
  TURSO_DATABASE_URL  예) libsql://xxx.turso.io
  TURSO_AUTH_TOKEN    예) eyJ...

실행:
  python3 scripts/daily_sec.py
"""

import os
import sys
import json
import time
import datetime
import requests

# ──────────────────────────────────────────────────────────────────────────────
# 0. .env.local 로드 (로컬 개발 시)
# ──────────────────────────────────────────────────────────────────────────────

def load_dotenv(path: str) -> None:
    """간단한 .env 파서"""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key not in os.environ:
                os.environ[key] = val

_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_script_dir, "..", ".env.local"))
load_dotenv(os.path.join(_script_dir, "..", ".env"))

TURSO_URL   = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 없습니다.")
    sys.exit(1)

http_url = TURSO_URL.replace("libsql://", "https://")

# SEC EDGAR User-Agent (필수: SEC 정책상 이메일 포함 필요)
SEC_USER_AGENT = "GSF-Investor/1.0 (asiaunion@gmail.com)"

# 수집 대상 SEC 양식 유형
TARGET_FORMS = {"10-Q", "10-K", "10-K/A", "10-Q/A"}

# ──────────────────────────────────────────────────────────────────────────────
# 1. Turso HTTP 헬퍼
# ──────────────────────────────────────────────────────────────────────────────

def _encode_param(p):
    if p is None:
        return {"type": "null"}
    if isinstance(p, bool):
        return {"type": "integer", "value": str(int(p))}
    if isinstance(p, int):
        return {"type": "integer", "value": str(p)}
    if isinstance(p, float):
        return {"type": "float", "value": p}
    return {"type": "text", "value": str(p)}


def turso_exec(statements: list) -> list:
    payload = {
        "requests": [
            {
                "type": "execute",
                "stmt": {
                    "sql": s["q"],
                    "args": [_encode_param(p) for p in s.get("params", [])],
                },
            }
            for s in statements
        ] + [{"type": "close"}]
    }
    resp = requests.post(
        f"{http_url}/v2/pipeline",
        headers={
            "Authorization": f"Bearer {TURSO_TOKEN}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP {resp.status_code}: {resp.text[:400]}")
    return resp.json().get("results", [])


def turso_one(sql: str, params: list = None) -> list:
    results = turso_exec([{"q": sql, "params": params or []}])
    if not results:
        return []
    res = results[0]
    if res.get("type") == "error":
        raise RuntimeError(f"SQL Error: {res}")
    rs = res.get("response", {}).get("result", {})
    cols = [c["name"] for c in rs.get("cols", [])]
    rows = []
    for row in rs.get("rows", []):
        rows.append(
            {cols[i]: (v.get("value") if v.get("type") != "null" else None)
             for i, v in enumerate(row)}
        )
    return rows


def turso_batch(statements: list) -> int:
    if not statements:
        return 0
    inserted = 0
    chunk_size = 200
    for i in range(0, len(statements), chunk_size):
        chunk = statements[i : i + chunk_size]
        results = turso_exec(chunk)
        for r in results:
            if r.get("type") == "error":
                print(f"  [WARN] 배치 오류: {r}")
            else:
                resp = r.get("response", {}).get("result", {})
                inserted += resp.get("affected_row_count", 0)
    return inserted


# ──────────────────────────────────────────────────────────────────────────────
# 2. 활성 US 종목 조회
# ──────────────────────────────────────────────────────────────────────────────

def fetch_us_stocks() -> list:
    """Turso에서 is_active=1이고 sec_cik가 있는 US 종목 반환."""
    rows = turso_one(
        """SELECT id AS stock_id, ticker, sec_cik, name
           FROM stocks
           WHERE is_active = 1
             AND sec_cik IS NOT NULL
             AND market = 'US'"""
    )
    return [
        {
            "stock_id": int(r["stock_id"]),
            "ticker": r["ticker"],
            "sec_cik": r["sec_cik"],
            "name": r["name"],
        }
        for r in rows
    ]


# ──────────────────────────────────────────────────────────────────────────────
# 3. SEC EDGAR submissions API 호출
# ──────────────────────────────────────────────────────────────────────────────

def fetch_sec_filings(cik: str, max_filings: int = 20) -> list:
    """
    SEC EDGAR submissions API로 최근 제출 목록 조회.
    10-Q/10-K만 필터링하여 반환.
    반환: [{"accession_no": "...", "form": "10-Q", "filed_at": "2026-05-10", "title": "..."}, ...]
    """
    # CIK를 10자리로 패딩
    cik_padded = str(cik).zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{cik_padded}.json"

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": SEC_USER_AGENT},
            timeout=20,
        )
        if resp.status_code != 200:
            print(f"    [WARN] SEC EDGAR HTTP {resp.status_code} for CIK {cik}")
            return []

        data = resp.json()
        filings_data = data.get("filings", {}).get("recent", {})

        forms = filings_data.get("form", [])
        dates = filings_data.get("filingDate", [])
        accessions = filings_data.get("accessionNumber", [])
        primary_docs = filings_data.get("primaryDocument", [])

        results = []
        count = 0

        for i, form in enumerate(forms):
            if form not in TARGET_FORMS:
                continue
            if count >= max_filings:
                break

            accession = accessions[i] if i < len(accessions) else ""
            filed_at = dates[i] if i < len(dates) else ""
            primary_doc = primary_docs[i] if i < len(primary_docs) else ""

            # SEC 제출 원문 URL
            accession_clean = accession.replace("-", "")
            raw_url = (
                f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_clean}/{primary_doc}"
                if accession_clean and primary_doc
                else f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik_padded}&type={form}"
            )

            results.append({
                "accession_no": accession,
                "form": form,
                "filed_at": filed_at,
                "title": f"{form} Filing",
                "raw_url": raw_url,
            })
            count += 1

        return results
    except Exception as e:
        print(f"    [ERROR] SEC EDGAR 요청 실패: {e}")
        return []


# ──────────────────────────────────────────────────────────────────────────────
# 4. 공시 저장
# ──────────────────────────────────────────────────────────────────────────────

def process_sec_filings(stock: dict, filings: list) -> dict:
    """
    SEC 제출 목록을 disclosures 테이블에 삽입.
    rcp_no를 accession_no로 사용 (중복 방지).
    반환: {"disclosures_inserted": int}
    """
    if not filings:
        return {"disclosures_inserted": 0}

    stock_id = stock["stock_id"]
    stmts = []

    for f in filings:
        accession = f.get("accession_no", "")
        title = f"{f['form']} — {stock['ticker']}"
        filed_at = f.get("filed_at", "")
        raw_url = f.get("raw_url", "")

        stmts.append({
            "q": """INSERT OR IGNORE INTO disclosures
                    (stock_id, source, filed_at, title, raw_url, rcp_no)
                    VALUES (?,?,?,?,?,?)""",
            "params": [stock_id, "SEC", filed_at, title, raw_url, accession or None],
        })

    inserted = turso_batch(stmts)
    return {"disclosures_inserted": inserted}


# ──────────────────────────────────────────────────────────────────────────────
# 5. 결과 요약 출력
# ──────────────────────────────────────────────────────────────────────────────

def print_summary(results: dict) -> None:
    print("\n" + "=" * 55)
    print("  📋 daily_sec.py 실행 결과 요약")
    print("=" * 55)

    total_disc = 0
    for ticker, r in results.items():
        if "error" in r:
            print(f"  ❌ {ticker}: {r['error']}")
        else:
            d = r.get("disclosures_inserted", 0)
            total_disc += d
            print(f"  ✅ {ticker}: 공시(10-Q/10-K) {d}건 신규")

    print(f"\n  합계: SEC 공시 {total_disc}건")
    print("=" * 55)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    run_ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("=" * 55)
    print(f"  GSF-Investor daily_sec.py — {run_ts}")
    print(f"  Turso: {http_url}")
    print("=" * 55)

    # 연결 테스트
    try:
        rows = turso_one("SELECT sqlite_version() AS v")
        print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")
    except Exception as e:
        print(f"\n[ERROR] Turso 연결 실패: {e}")
        sys.exit(1)

    # US 활성 종목 조회
    stocks = fetch_us_stocks()
    if not stocks:
        print("[WARN] SEC 수집 대상 종목이 없습니다. (sec_cik 있는 US 종목 필요)")
        sys.exit(0)
    print(f"✅ SEC 수집 대상: {len(stocks)}종목 — {[s['ticker'] for s in stocks]}\n")

    results = {}

    for stock in stocks:
        ticker = stock["ticker"]
        cik = stock["sec_cik"]
        print(f"  📥 {ticker} ({stock['name']}) SEC 제출 조회 중... CIK={cik}")

        try:
            filings = fetch_sec_filings(cik, max_filings=20)
            print(f"    → {len(filings)}건 10-Q/10-K 수신")
            result = process_sec_filings(stock, filings)
            results[ticker] = result
        except Exception as e:
            print(f"    [ERROR] {e}")
            results[ticker] = {"error": str(e)}

        time.sleep(0.5)  # SEC EDGAR 부하 분산

    print_summary(results)

    has_error = any("error" in r for r in results.values())
    if has_error:
        print("\n⚠️  일부 수집 실패 — GitHub Actions에서 경고로 처리됩니다.")
        sys.exit(1)


if __name__ == "__main__":
    main()
