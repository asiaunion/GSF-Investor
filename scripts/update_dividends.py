#!/usr/bin/env python3
"""
update_dividends.py — DART alotMatter API로 배당 데이터 수집 후 DB 업데이트
==========================================================================
DART 배당현황(alotMatter) API에서 종목별 주당 현금배당금을 가져와
financials 테이블의 연간(FY) 행에 dividend_per_share를 업데이트합니다.

실행: python3 scripts/update_dividends.py

환경변수:
  TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, DART_API_KEY
  REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE  (원격 DB 쓰기 허용)
"""

import os, sys, time, requests
from typing import Optional

# ── .env 로드 ─────────────────────────────────────────────────────────────────
def load_dotenv(path: str) -> None:
    if not os.path.exists(path): return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k, _, v = line.partition("=")
            k = k.strip(); v = v.strip().strip('"').strip("'")
            if k not in os.environ: os.environ[k] = v

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from real_data_guard import enforce_remote_write_guard

TURSO_URL   = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")
DART_KEY    = os.environ.get("DART_API_KEY", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 없음"); sys.exit(1)
if not DART_KEY:
    print("[ERROR] DART_API_KEY 없음"); sys.exit(1)

http_url = TURSO_URL.replace("libsql://", "https://")

# ── Turso 헬퍼 ────────────────────────────────────────────────────────────────
def turso_exec(statements: list) -> list:
    payload = {"requests": [
        {"type": "execute", "stmt": {"sql": s["q"], "args": [
            {"type": "text",    "value": str(p)}            if isinstance(p, str)
            else {"type": "integer", "value": str(int(p))} if isinstance(p, int) and not isinstance(p, bool)
            else {"type": "float",   "value": float(p)}     if isinstance(p, float)
            else {"type": "null"}
            for p in s.get("params", [])
        ]}}
        for s in statements
    ] + [{"type": "close"}]}
    resp = requests.post(
        f"{http_url}/v2/pipeline",
        headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"},
        json=payload, timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json().get("results", [])

def turso_one(sql: str, params: list = None) -> list:
    results = turso_exec([{"q": sql, "params": params or []}])
    if not results: return []
    res = results[0]
    if res.get("type") == "error":
        raise RuntimeError(f"SQL Error: {res}")
    rs = res.get("response", {}).get("result", {})
    cols = [c["name"] for c in rs.get("cols", [])]
    return [{cols[i]: (v.get("value") if v.get("type") != "null" else None)
             for i, v in enumerate(row)} for row in rs.get("rows", [])]

# ── DART alotMatter API ────────────────────────────────────────────────────────
# reprt_code: 11011=사업보고서(연간), 11012=반기, 11013=1분기, 11014=3분기
REPORT_CODES = {
    "11011": "사업보고서",
}

def fetch_dart_dividend(corp_code: str, year: int) -> Optional[float]:
    """
    DART alotMatter API로 연간 주당 현금배당금(보통주) 반환.
    사업보고서(11011) 기준.
    """
    url = "https://opendart.fss.or.kr/api/alotMatter.json"
    params = {
        "crtfc_key": DART_KEY,
        "corp_code": corp_code,
        "bsns_year": str(year),
        "reprt_code": "11011",
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        data = resp.json()
        if data.get("status") != "000":
            print(f"    [WARN] DART alotMatter {year}년 데이터 없음: {data.get('message')}")
            return None

        items = data.get("list", [])
        # "주당 현금배당금(원)" + stock_knd="보통주" 항목 찾기
        for item in items:
            se = item.get("se", "")
            stock_knd = item.get("stock_knd", "")
            if "주당 현금배당금" in se and stock_knd == "보통주":
                val_str = item.get("thstrm", "").replace(",", "").strip()
                if val_str and val_str != "-":
                    try:
                        return float(val_str)
                    except ValueError:
                        pass

        # fallback: 배당수익률만 있는 경우 skip
        print(f"    [INFO] {year}년 주당배당금 항목 없음 (무배당 또는 데이터 없음)")
        return None
    except Exception as e:
        print(f"    [ERROR] DART alotMatter API 오류: {e}")
        return None

# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    enforce_remote_write_guard(database_url=TURSO_URL, script_name="update_dividends.py")
    print("=" * 60)
    print("  GSF-Investor — DART 배당 데이터 업데이트 (alotMatter)")
    print(f"  Turso: {http_url}")
    print("=" * 60)

    # 연결 테스트
    rows = turso_one("SELECT sqlite_version() AS v")
    print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")

    # DB에서 활성 KR 종목 + dart_corp_code 조회
    stocks = turso_one("""
        SELECT id, ticker, name, dart_corp_code
        FROM stocks
        WHERE is_active = 1
          AND dart_corp_code IS NOT NULL
          AND market = 'KR'
    """)

    if not stocks:
        print("[WARN] 대상 종목 없음")
        sys.exit(0)

    print(f"대상 종목: {[s['ticker'] for s in stocks]}\n")

    total_updated = 0

    for stock in stocks:
        stock_id    = int(stock["id"])
        ticker      = stock["ticker"]
        name        = stock["name"]
        corp_code   = stock["dart_corp_code"]

        print(f"\n📊 {ticker} ({name}) corp_code={corp_code}")

        # DB에서 FY 행 조회 (연간 배당만 FY에 적용)
        fy_rows = turso_one(
            "SELECT id, period FROM financials WHERE stock_id=? AND period LIKE '%FY' ORDER BY period ASC",
            [stock_id]
        )

        if not fy_rows:
            print(f"  [SKIP] FY 재무 데이터 없음")
            continue

        for fy in fy_rows:
            period     = fy["period"]       # ex) "2024FY"
            fin_id     = fy["id"]
            year       = int(period.replace("FY", ""))

            print(f"  📥 {period} ({year}년) 배당 조회...", end=" ", flush=True)
            dps = fetch_dart_dividend(corp_code, year)

            if dps is None:
                print("→ 없음 (SKIP)")
                time.sleep(0.3)
                continue

            # DB 업데이트
            turso_one(
                "UPDATE financials SET dividend_per_share=? WHERE id=?",
                [dps, int(fin_id)]
            )
            print(f"→ ₩{dps:,.0f}원 ✅")
            total_updated += 1
            time.sleep(0.3)

    print(f"\n{'='*60}")
    print(f"  완료 — 업데이트: {total_updated}건")
    print(f"{'='*60}\n")

    # 최종 검증 출력
    print("=== dividend_per_share 현황 ===")
    for stock in stocks:
        stock_id = int(stock["id"])
        rows = turso_one(
            "SELECT period, dividend_per_share FROM financials WHERE stock_id=? AND period LIKE '%FY' ORDER BY period ASC",
            [stock_id]
        )
        print(f"\n{stock['ticker']} ({stock['name']})")
        for r in rows:
            dps_val = r.get("dividend_per_share")
            dps_str = f"₩{float(dps_val):,.0f}원" if dps_val else "null (무배당/미수집)"
            print(f"  {r['period']}: {dps_str}")

if __name__ == "__main__":
    main()
