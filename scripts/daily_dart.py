#!/usr/bin/env python3
"""
GSF-Investor Phase 2 — daily_dart.py
=====================================
매일 KST 07:30 (UTC 22:30 전날) GitHub Actions 크론으로 실행.

수집 대상:
  - DB의 활성 종목(is_active=1, dart_corp_code IS NOT NULL)
  - DART OpenAPI: 최근 공시 목록 (disclosureList)

HIGH 시그널 즉시 감지 룰:
  - INSIDER_BUY: 임원·주요주주 거래 공시 (pblntf_detail_ty=B001 or 제목 패턴)
  - STAKE_CHANGE: 대량보유상황보고 (pblntf_detail_ty=I002)

환경변수 (GitHub Secrets):
  TURSO_DATABASE_URL  예) libsql://xxx.turso.io
  TURSO_AUTH_TOKEN    예) eyJ...
  DART_API_KEY        DART OpenAPI 인증키

실행:
  python3 scripts/daily_dart.py
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
    """간단한 .env 파서 (python-dotenv 미사용)"""
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
DART_KEY    = os.environ.get("DART_API_KEY", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 없습니다.")
    sys.exit(1)

if not DART_KEY:
    print("[ERROR] DART_API_KEY 환경변수가 없습니다.")
    sys.exit(1)

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

def notify_telegram(message: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"}
    try:
        requests.post(url, json=payload, timeout=5)
    except Exception as e:
        print(f"    [WARN] Telegram 알림 실패: {e}")

# libsql:// → https://
http_url = TURSO_URL.replace("libsql://", "https://")

# ──────────────────────────────────────────────────────────────────────────────
# 1. Turso HTTP 헬퍼 (daily_price.py와 동일 패턴)
# ──────────────────────────────────────────────────────────────────────────────

def _encode_param(p):
    """Python 값 → Turso typed arg"""
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
    """Turso HTTP API 배치 실행"""
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
    """단일 쿼리 → rows 리스트 반환"""
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
    """여러 INSERT를 200개씩 나눠 실행 → 삽입 성공 건수 반환"""
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
# 2. 활성 KR 종목 조회
# ──────────────────────────────────────────────────────────────────────────────

def fetch_kr_stocks() -> list:
    """
    Turso에서 is_active=1이고 dart_corp_code가 있는 KR 종목 반환.
    반환: [{"stock_id": 1, "ticker": "026960", "dart_corp_code": "00296060", "name": "동서"}, ...]
    """
    rows = turso_one(
        """SELECT id AS stock_id, ticker, dart_corp_code, name
           FROM stocks
           WHERE is_active = 1
             AND dart_corp_code IS NOT NULL
             AND market = 'KR'"""
    )
    return [
        {
            "stock_id": int(r["stock_id"]),
            "ticker": r["ticker"],
            "dart_corp_code": r["dart_corp_code"],
            "name": r["name"],
        }
        for r in rows
    ]


# ──────────────────────────────────────────────────────────────────────────────
# 3. DART OpenAPI 공시 수집
# ──────────────────────────────────────────────────────────────────────────────

DART_API_BASE = "https://opendart.fss.or.kr/api"

# HIGH 시그널 공시 유형 코드 (DART pblntf_detail_ty)
HIGH_SIGNAL_CODES = {
    "B001": "INSIDER_BUY",   # 임원·주요주주 특정증권 등 소유상황보고서
    "B002": "INSIDER_BUY",   # 임원·주요주주 특정증권 등 소유상황보고서(기재정정)
    "I001": "STAKE_CHANGE",  # 주식대량보유상황보고서(일반)
    "I002": "STAKE_CHANGE",  # 주식대량보유상황보고서(약식)
    "I003": "STAKE_CHANGE",  # 주식대량보유상황보고서(기재정정)
}

# 제목 키워드 패턴 → HIGH 시그널 매핑 (코드로 잡히지 않는 케이스 보완)
HIGH_SIGNAL_TITLE_PATTERNS = [
    ("임원·주요주주", "INSIDER_BUY"),
    ("임원ㆍ주요주주", "INSIDER_BUY"),
    ("주식대량보유", "STAKE_CHANGE"),
    ("대량보유상황", "STAKE_CHANGE"),
]


def _detect_signal_type(pblntf_detail_ty: str, title: str) -> tuple:
    """
    공시 유형 코드 + 제목으로 시그널 유형 감지.
    반환: (signal_type: str | None, severity: str)
    """
    # 코드 매핑 먼저
    if pblntf_detail_ty and pblntf_detail_ty in HIGH_SIGNAL_CODES:
        return HIGH_SIGNAL_CODES[pblntf_detail_ty], "HIGH"

    # 제목 패턴 매칭
    for keyword, signal_type in HIGH_SIGNAL_TITLE_PATTERNS:
        if keyword in (title or ""):
            return signal_type, "HIGH"

    return None, "LOW"


def fetch_dart_disclosures(corp_code: str, days: int = 2) -> list:
    """
    DART OpenAPI disclosureList 호출.
    최근 days일의 공시 목록을 반환.
    반환: [{"rcp_no": "...", "report_nm": "...", "rcept_dt": "20260516", "pblntf_detail_ty": "B001"}, ...]
    """
    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=days)

    params = {
        "crtfc_key": DART_KEY,
        "corp_code": corp_code,
        "bgn_de": start_date.strftime("%Y%m%d"),
        "end_de": end_date.strftime("%Y%m%d"),
        "page_no": 1,
        "page_count": 40,
    }

    try:
        resp = requests.get(
            f"{DART_API_BASE}/list.json",
            params=params,
            timeout=15,
        )
        if resp.status_code != 200:
            print(f"    [WARN] DART API HTTP {resp.status_code}")
            return []

        data = resp.json()
        status = data.get("status", "999")
        if status == "013":
            # 조회된 데이터 없음 (정상)
            return []
        if status != "000":
            print(f"    [WARN] DART API 오류: status={status}, message={data.get('message')}")
            return []

        return data.get("list", [])
    except Exception as e:
        print(f"    [ERROR] DART API 요청 실패: {e}")
        return []


# ──────────────────────────────────────────────────────────────────────────────
# 4. 공시 저장 + 시그널 감지
# ──────────────────────────────────────────────────────────────────────────────

def process_disclosures(stock: dict, dart_list: list) -> dict:
    """
    공시 목록을 disclosures 테이블에 삽입하고 HIGH 시그널을 감지.
    반환: {"disclosures_inserted": int, "signals_inserted": int}
    """
    if not dart_list:
        return {"disclosures_inserted": 0, "signals_inserted": 0}

    stock_id = stock["stock_id"]
    disclosure_stmts = []
    signal_stmts = []

    for item in dart_list:
        rcp_no = item.get("rcept_no", "")
        report_nm = item.get("report_nm", "")
        rcept_dt = item.get("rcept_dt", "")  # "20260516" 형식
        pblntf_detail_ty = item.get("pblntf_detail_ty", "")

        # 날짜 포맷 변환: "20260516" → "2026-05-16"
        if rcept_dt and len(rcept_dt) == 8:
            filed_at = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:]}"
        else:
            filed_at = rcept_dt

        # DART 공시 원문 URL
        raw_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcp_no}" if rcp_no else None

        # disclosures INSERT OR IGNORE (rcp_no 기반 중복 방지)
        disclosure_stmts.append({
            "q": """INSERT OR IGNORE INTO disclosures
                    (stock_id, source, filed_at, title, raw_url, rcp_no)
                    VALUES (?,?,?,?,?,?)""",
            "params": [stock_id, "DART", filed_at, report_nm, raw_url, rcp_no or None],
        })

        # HIGH 시그널 감지
        signal_type, severity = _detect_signal_type(pblntf_detail_ty, report_nm)
        if signal_type and severity == "HIGH":
            description = f"[{signal_type}] {report_nm} (rcpNo: {rcp_no})"
            signal_stmts.append({
                "q": """INSERT INTO signals
                        (stock_id, type, severity, description, detected_at)
                        VALUES (?,?,?,?,datetime('now'))""",
                "params": [stock_id, signal_type, severity, description],
            })
            print(f"    🔴 HIGH 시그널 감지: [{signal_type}] {report_nm}")
            notify_telegram(f"🚨 <b>HIGH 시그널 감지</b>\n종목: {stock['name']} ({stock['ticker']})\n유형: {signal_type}\n공시: <a href='{raw_url}'>{report_nm}</a>")

    disc_inserted = turso_batch(disclosure_stmts)
    sig_inserted = turso_batch(signal_stmts)

    return {"disclosures_inserted": disc_inserted, "signals_inserted": sig_inserted}


# ──────────────────────────────────────────────────────────────────────────────
# 5. 결과 요약 출력
# ──────────────────────────────────────────────────────────────────────────────

def print_summary(results: dict) -> None:
    print("\n" + "=" * 55)
    print("  📋 daily_dart.py 실행 결과 요약")
    print("=" * 55)

    total_disc = 0
    total_sig = 0

    for ticker, r in results.items():
        if "error" in r:
            print(f"  ❌ {ticker}: {r['error']}")
        else:
            d = r.get("disclosures_inserted", 0)
            s = r.get("signals_inserted", 0)
            total_disc += d
            total_sig += s
            sig_badge = f" | 🔴 시그널 {s}건" if s > 0 else ""
            print(f"  ✅ {ticker}: 공시 {d}건 신규{sig_badge}")

    print(f"\n  합계: 공시 {total_disc}건 | 시그널 {total_sig}건")
    print("=" * 55)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    run_ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("=" * 55)
    print(f"  GSF-Investor daily_dart.py — {run_ts}")
    print(f"  Turso: {http_url}")
    print("=" * 55)

    # 연결 테스트
    try:
        rows = turso_one("SELECT sqlite_version() AS v")
        print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")
    except Exception as e:
        print(f"\n[ERROR] Turso 연결 실패: {e}")
        sys.exit(1)

    # KR 활성 종목 조회
    stocks = fetch_kr_stocks()
    if not stocks:
        print("[WARN] DART 수집 대상 종목이 없습니다.")
        sys.exit(0)
    print(f"✅ DART 수집 대상: {len(stocks)}종목 — {[s['ticker'] for s in stocks]}\n")

    results = {}

    for stock in stocks:
        ticker = stock["ticker"]
        corp_code = stock["dart_corp_code"]
        print(f"  📥 {ticker} ({stock['name']}) 공시 조회 중... corp_code={corp_code}")

        try:
            dart_list = fetch_dart_disclosures(corp_code, days=2)
            print(f"    → {len(dart_list)}건 수신")
            result = process_disclosures(stock, dart_list)
            results[ticker] = result
        except Exception as e:
            print(f"    [ERROR] {e}")
            results[ticker] = {"error": str(e)}

        time.sleep(0.5)  # DART API 부하 분산

    print_summary(results)

    # 오류가 하나라도 있으면 exit code 1
    has_error = any("error" in r for r in results.values())
    if has_error:
        print("\n⚠️  일부 수집 실패 — GitHub Actions에서 경고로 처리됩니다.")
        sys.exit(1)


if __name__ == "__main__":
    main()
