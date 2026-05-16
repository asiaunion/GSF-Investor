#!/usr/bin/env python3
"""
GSF-Investor Phase 1 Day 3 — seed_portfolio.py
=================================================
1. stocks 테이블: 관심종목 등록 (ticker/yahoo_ticker/dart_corp_code/sec_cik)
2. trade_journal 테이블: INIT 레코드 삽입 (현재 보유 수량 + 평균 매입가)
3. prices 테이블: Yahoo Finance history(period='2y') 2년치 일봉 벌크 시딩
4. financials 테이블: DART OpenAPI 최근 8분기 재무제표 벌크 시딩
5. exchange_rates 테이블: Yahoo Finance USDKRW=X 2년치
6. 검증: v_portfolio View 출력

실행 방법:
  python3 scripts/seed_portfolio.py

환경변수 (필수):
  TURSO_DATABASE_URL  예) libsql://xxx.turso.io
  TURSO_AUTH_TOKEN    예) eyJ...
  DART_API_KEY        예) abc123...

환경변수 로드 순서: 환경변수 > .env.local > .env
"""

import os
import sys
import json
import time
import datetime
import requests
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# 0. .env.local 로드 (파일 존재 시)
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

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

TURSO_URL   = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")
DART_KEY    = os.environ.get("DART_API_KEY", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 없습니다.")
    print("        .env.local 파일을 확인하거나 환경변수를 설정해주세요.")
    sys.exit(1)

# libsql HTTP endpoint 변환: libsql://xxx → https://xxx
http_url = TURSO_URL.replace("libsql://", "https://")

# ──────────────────────────────────────────────────────────────────────────────
# 1. Turso HTTP 헬퍼
# ──────────────────────────────────────────────────────────────────────────────

def turso_exec(statements: list) -> list:
    """
    Turso HTTP API 실행 (배치 가능).
    statements = [{"q": "SELECT ...", "params": [...]}]
    """
    payload = {"requests": [
        {"type": "execute", "stmt": {"sql": s["q"], "args": [
            {"type": "text",    "value": str(p)}          if isinstance(p, str)
            else {"type": "integer", "value": str(int(p))}   if isinstance(p, int) and not isinstance(p, bool)
            else {"type": "float",   "value": float(p)}       if isinstance(p, float)
            else {"type": "null"}
            for p in s.get("params", [])
        ]}}
        for s in statements
    ] + [{"type": "close"}]}

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
        raise RuntimeError(f"Turso HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json().get("results", [])


def turso_one(sql: str, params: list = None) -> list:
    """단일 쿼리 실행 → rows 리스트 반환"""
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
        rows.append({cols[i]: (v.get("value") if v.get("type") != "null" else None)
                     for i, v in enumerate(row)})
    return rows


def turso_batch(statements: list) -> None:
    """여러 INSERT/UPDATE를 한 번에 실행"""
    if not statements:
        return
    # 200개씩 나눠서 실행 (Turso 배치 제한 대응)
    chunk_size = 200
    for i in range(0, len(statements), chunk_size):
        chunk = statements[i:i+chunk_size]
        results = turso_exec(chunk)
        errors = [r for r in results if r.get("type") == "error"]
        if errors:
            print(f"  [WARN] 배치 오류 {len(errors)}건: {errors[0]}")


# ──────────────────────────────────────────────────────────────────────────────
# 2. 관심종목 하드코딩 데이터
# ──────────────────────────────────────────────────────────────────────────────

STOCKS = [
    {
        "ticker":        "026960",
        "yahoo_ticker":  "026960.KS",
        "dart_corp_code": "00144395",  # DART corpCode.xml 1차 확인 (2026-05-16)
        "sec_cik":       None,
        "name":          "동서",
        "market":        "KR",
        "category":      "Core",
        "broker":        "대신증권",
        "thesis":        "저평가 가치주 + 동서식품 지분 이벤트 드리븐. PBR<1, 배당수익률 3%+, 몬델리즈 지분 매각 카탈리스트.",
    },
    {
        "ticker":        "059090",
        "yahoo_ticker":  "059090.KQ",
        "dart_corp_code": "00366942",  # DART corpCode.xml 1차 확인 (2026-05-16)
        "sec_cik":       None,
        "name":          "미코",
        "market":        "KR",
        "category":      "Core",
        "broker":        "대신증권",
        "thesis":        "KOSDAQ 코어 보유종목.",
    },
]

# ──────────────────────────────────────────────────────────────────────────────
# 3. 보유 현황 하드코딩 (INIT 레코드)
# ──────────────────────────────────────────────────────────────────────────────

HOLDINGS = [
    {
        "ticker":    "026960",
        "quantity":  2600,
        "price":     28350.0,    # 원화 평균단가
        "currency":  "KRW",
        "category":  "Core",
        "traded_at": "2026-05-15T09:00:00",
    },
    {
        "ticker":    "059090",
        "quantity":  420,
        "price":     25750.0,    # 원화 평균단가
        "currency":  "KRW",
        "category":  "Core",
        "traded_at": "2026-05-15T09:00:00",
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# STEP 1: stocks 등록
# ──────────────────────────────────────────────────────────────────────────────

def seed_stocks() -> dict:
    """
    stocks 테이블에 관심종목 UPSERT.
    반환값: {ticker: stock_id}
    """
    print("\n[STEP 1] stocks 테이블 시딩...")
    ticker_to_id = {}

    for s in STOCKS:
        # 이미 존재하면 UPDATE, 없으면 INSERT
        existing = turso_one(
            "SELECT id FROM stocks WHERE ticker = ?", [s["ticker"]]
        )
        if existing:
            stock_id = int(existing[0]["id"])
            turso_one(
                """UPDATE stocks SET
                    yahoo_ticker=?, dart_corp_code=?, sec_cik=?,
                    name=?, market=?, category=?, broker=?, thesis=?, is_active=1
                WHERE ticker=?""",
                [
                    s["yahoo_ticker"], s["dart_corp_code"], s["sec_cik"],
                    s["name"], s["market"], s["category"], s["broker"], s["thesis"],
                    s["ticker"],
                ]
            )
            print(f"  ✅ UPDATE: {s['ticker']} ({s['name']}) id={stock_id}")
        else:
            turso_one(
                """INSERT INTO stocks
                    (ticker, yahoo_ticker, dart_corp_code, sec_cik, name, market, category, broker, thesis)
                VALUES (?,?,?,?,?,?,?,?,?)""",
                [
                    s["ticker"], s["yahoo_ticker"], s["dart_corp_code"], s["sec_cik"],
                    s["name"], s["market"], s["category"], s["broker"], s["thesis"],
                ]
            )
            row = turso_one("SELECT id FROM stocks WHERE ticker = ?", [s["ticker"]])
            stock_id = int(row[0]["id"])
            print(f"  ✅ INSERT: {s['ticker']} ({s['name']}) id={stock_id}")

        ticker_to_id[s["ticker"]] = stock_id

    return ticker_to_id


# ──────────────────────────────────────────────────────────────────────────────
# STEP 2: trade_journal INIT 레코드
# ──────────────────────────────────────────────────────────────────────────────

def seed_init_journal(ticker_to_id: dict) -> None:
    print("\n[STEP 2] trade_journal INIT 레코드 삽입...")
    for h in HOLDINGS:
        if h["quantity"] == 0:
            print(f"  ⚠️  {h['ticker']}: quantity=0 → SKIP (실제 보유 수량을 스크립트에 입력해주세요)")
            continue

        stock_id = ticker_to_id.get(h["ticker"])
        if not stock_id:
            print(f"  [WARN] {h['ticker']} stock_id 없음 — SKIP")
            continue

        # 이미 INIT 레코드가 있으면 중복 삽입 안 함
        existing = turso_one(
            "SELECT id FROM trade_journal WHERE stock_id=? AND action='INIT'",
            [stock_id]
        )
        if existing:
            print(f"  ⏭️  {h['ticker']}: INIT 레코드 이미 존재 (id={existing[0]['id']}) — SKIP")
            continue

        turso_one(
            """INSERT INTO trade_journal
                (stock_id, traded_at, action, quantity, price, currency, thesis, category)
            VALUES (?,?,?,?,?,?,?,?)""",
            [
                stock_id,
                h["traded_at"],
                "INIT",
                h["quantity"],
                h["price"],
                h["currency"],
                "기존 보유분 초기 등록 (seed_portfolio.py)",
                h["category"],
            ]
        )
        print(f"  ✅ {h['ticker']}: INIT {h['quantity']}주 @ {h['price']} {h['currency']}")


# ──────────────────────────────────────────────────────────────────────────────
# STEP 3: prices — Yahoo Finance 2년치 일봉
# ──────────────────────────────────────────────────────────────────────────────

def seed_prices(ticker_to_id: dict) -> None:
    print("\n[STEP 3] prices 테이블 시딩 (Yahoo Finance 2년치)...")
    try:
        import yfinance as yf
    except ImportError:
        print("  [ERROR] yfinance 미설치: pip3 install yfinance")
        return

    # 환율(USDKRW=X) 포함
    yahoo_ticker_map = {}
    for s in STOCKS:
        if s["yahoo_ticker"] and s["ticker"] in ticker_to_id:
            currency = "USD" if s["market"] == "US" else "KRW"
            yahoo_ticker_map[s["yahoo_ticker"]] = (s["ticker"], str(ticker_to_id[s["ticker"]]), currency)

    for yahoo_sym, (ticker, stock_id_str, currency) in yahoo_ticker_map.items():
        print(f"  📥 {yahoo_sym} ({ticker}) 다운로드 중...")
        try:
            hist = yf.download(yahoo_sym, period="2y", auto_adjust=True, progress=False)
            if hist.empty:
                print(f"     [WARN] {yahoo_sym}: 데이터 없음")
                continue

            stmts = []
            for date_idx, row in hist.iterrows():
                date_str = date_idx.strftime("%Y-%m-%d")
                close = float(row["Close"].item()) if hasattr(row["Close"], "item") else float(row["Close"])
                volume = int(row["Volume"].item()) if hasattr(row["Volume"], "item") else int(row["Volume"])
                dividend = 0.0

                stmts.append({
                    "q": """INSERT OR IGNORE INTO prices
                            (stock_id, date, close_price, volume, dividend, currency)
                            VALUES (?,?,?,?,?,?)""",
                    "params": [int(stock_id_str), date_str, close, volume, dividend, currency],
                })

            turso_batch(stmts)
            print(f"     ✅ {len(stmts)}행 삽입 완료 ({yahoo_sym})")
            time.sleep(0.5)  # Yahoo Finance 과부하 방지

        except Exception as e:
            print(f"     [ERROR] {yahoo_sym}: {e}")


# ──────────────────────────────────────────────────────────────────────────────
# STEP 4: exchange_rates — Yahoo Finance USDKRW=X 2년치
# ──────────────────────────────────────────────────────────────────────────────

def seed_exchange_rates() -> None:
    print("\n[STEP 4] exchange_rates 시딩 (USDKRW=X 2년치)...")
    try:
        import yfinance as yf
    except ImportError:
        print("  [ERROR] yfinance 미설치")
        return

    try:
        hist = yf.download("USDKRW=X", period="2y", auto_adjust=True, progress=False)
        if hist.empty:
            print("  [WARN] USDKRW=X 데이터 없음")
            return

        stmts = []
        for date_idx, row in hist.iterrows():
            date_str = date_idx.strftime("%Y-%m-%d")
            rate = float(row["Close"].item()) if hasattr(row["Close"], "item") else float(row["Close"])
            stmts.append({
                "q": """INSERT OR IGNORE INTO exchange_rates (pair, date, rate)
                        VALUES (?,?,?)""",
                "params": ["USDKRW", date_str, rate],
            })

        turso_batch(stmts)
        print(f"  ✅ {len(stmts)}행 삽입 완료 (USDKRW)")

    except Exception as e:
        print(f"  [ERROR] USDKRW=X: {e}")


# ──────────────────────────────────────────────────────────────────────────────
# STEP 5: financials — DART OpenAPI 최근 8분기
# ──────────────────────────────────────────────────────────────────────────────

DART_REPORT_CODES = {
    "1분기보고서": "11013",
    "반기보고서":  "11012",
    "3분기보고서": "11014",
    "사업보고서":  "11011",
}

def fetch_dart_financials(corp_code: str, year: int, report_code: str) -> Optional[dict]:
    """DART 단일회사 재무제표 조회 (주요계정 기준)"""
    if not DART_KEY:
        return None

    url = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"
    params = {
        "crtfc_key": DART_KEY,
        "corp_code": corp_code,
        "bsns_year": str(year),
        "reprt_code": report_code,
        "fs_div": "OFS",  # 별도재무제표
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        data = resp.json()
        if data.get("status") != "000":
            return None
        return data
    except Exception as e:
        print(f"    [WARN] DART API 오류: {e}")
        return None


def parse_dart_amount(val_str: Optional[str]) -> Optional[float]:
    """DART 금액 문자열 → float (단위: 원)"""
    if not val_str or val_str.strip() == "":
        return None
    try:
        return float(val_str.replace(",", "").strip()) * 1_000_000  # 백만원 단위
    except ValueError:
        return None


def seed_financials(ticker_to_id: dict) -> None:
    print("\n[STEP 5] financials 시딩 (DART 최근 8분기)...")

    if not DART_KEY:
        print("  ⚠️  DART_API_KEY 없음 → financials 시딩 SKIP")
        print("      .env.local에 DART_API_KEY=xxx 를 추가 후 재실행하세요.")
        return

    # DART 대상 종목만 (KR + dart_corp_code 보유)
    dart_stocks = [s for s in STOCKS if s.get("dart_corp_code") and s["ticker"] in ticker_to_id]

    # 최근 8분기 = 현재 기준 2년치
    today = datetime.date.today()
    quarters_to_fetch = []  # (year, quarter_label, report_code)

    for y_offset in range(3):  # 올해 포함 3년치 시도 (8분기 확보용)
        year = today.year - y_offset
        if y_offset == 0:
            # 현재 연도: 현재 분기만
            if today.month >= 11:
                quarters_to_fetch.extend([
                    (year, f"{year}Q3", "11014"),
                    (year, f"{year}Q2", "11012"),
                    (year, f"{year}Q1", "11013"),
                ])
            elif today.month >= 8:
                quarters_to_fetch.extend([
                    (year, f"{year}Q2", "11012"),
                    (year, f"{year}Q1", "11013"),
                ])
            elif today.month >= 5:
                quarters_to_fetch.append((year, f"{year}Q1", "11013"))
        else:
            # 과거 연도: 전체 4분기
            quarters_to_fetch.extend([
                (year, f"{year}FY",  "11011"),  # 사업보고서 (FY = Q4 포함)
                (year, f"{year}Q3",  "11014"),
                (year, f"{year}Q2",  "11012"),
                (year, f"{year}Q1",  "11013"),
            ])

    # 최근 8개만
    quarters_to_fetch = quarters_to_fetch[:8]

    for s in dart_stocks:
        corp_code = s["dart_corp_code"]
        stock_id  = ticker_to_id[s["ticker"]]
        print(f"\n  📊 {s['ticker']} ({s['name']}) corp_code={corp_code}")

        for year, period_label, report_code in quarters_to_fetch:
            existing = turso_one(
                "SELECT id FROM financials WHERE stock_id=? AND period=? AND source='DART'",
                [stock_id, period_label]
            )
            if existing:
                print(f"    ⏭️  {period_label}: 이미 존재 — SKIP")
                continue

            print(f"    📥 {period_label} ({report_code}) 조회 중...", end=" ")
            data = fetch_dart_financials(corp_code, year, report_code)
            if not data:
                print("데이터 없음")
                continue

            # 계정과목 파싱 (별도재무제표 기준)
            accounts = data.get("list", [])
            acc_map: dict[str, str] = {}
            for acc in accounts:
                label = acc.get("account_nm", "").strip()
                val   = acc.get("thstrm_amount", "") or acc.get("thstrm_add_amount", "")
                acc_map[label] = val

            def get_amount(labels: list[str]) -> float | None:
                for lbl in labels:
                    if lbl in acc_map:
                        return parse_dart_amount(acc_map[lbl])
                return None

            revenue      = get_amount(["매출액", "영업수익", "수익(매출액)"])
            op_income    = get_amount(["영업이익", "영업이익(손실)"])
            net_income   = get_amount(["당기순이익", "당기순이익(손실)"])
            total_assets = get_amount(["자산총계"])
            total_equity = get_amount(["자본총계"])
            cash_eq      = get_amount(["현금및현금성자산"])
            div_per_sh   = get_amount(["주당배당금"])

            # 재무비율 계산
            debt_ratio = None
            if total_equity and total_assets and total_equity != 0:
                total_liab = total_assets - total_equity
                debt_ratio = round(total_liab / total_equity * 100, 2)

            turso_one(
                """INSERT OR REPLACE INTO financials
                    (stock_id, period, revenue, op_income, net_income,
                     total_assets, total_equity, cash_and_equivalents,
                     debt_ratio, dividend_per_share, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                [
                    stock_id, period_label,
                    revenue, op_income, net_income,
                    total_assets, total_equity, cash_eq,
                    debt_ratio, div_per_sh,
                    "DART",
                ]
            )
            print(f"✅ (매출:{revenue}, 영익:{op_income})")
            time.sleep(0.3)  # DART API 레이트 리밋


# ──────────────────────────────────────────────────────────────────────────────
# STEP 6: 검증 — v_portfolio View
# ──────────────────────────────────────────────────────────────────────────────

def verify_portfolio() -> None:
    print("\n[STEP 6] v_portfolio View 검증...")
    rows = turso_one("SELECT * FROM v_portfolio")
    if not rows:
        print("  ⚠️  v_portfolio 결과 없음")
        print("     → trade_journal에 INIT 레코드가 있는지, quantity > 0인지 확인하세요.")
        return

    print("  ┌─────────────────────────────────────────────────────────")
    print("  │ ticker  │ name             │ qty  │ avg_price │ currency")
    print("  ├─────────────────────────────────────────────────────────")
    for r in rows:
        print(f"  │ {r.get('ticker',''):<7} │ {r.get('name',''):<16} │ "
              f"{str(r.get('quantity','')):<4} │ {str(r.get('avg_price','')):<9} │ {r.get('currency','')}")
    print("  └─────────────────────────────────────────────────────────")

    # prices 카운트
    for s in STOCKS:
        cnt = turso_one(
            "SELECT COUNT(*) as cnt FROM prices p JOIN stocks s ON p.stock_id=s.id WHERE s.ticker=?",
            [s["ticker"]]
        )
        print(f"  📈 prices [{s['ticker']}]: {cnt[0]['cnt']}행")

    # exchange_rates 카운트
    fx_cnt = turso_one("SELECT COUNT(*) as cnt FROM exchange_rates WHERE pair='USDKRW'")
    print(f"  💱 exchange_rates [USDKRW]: {fx_cnt[0]['cnt']}행")

    # financials 카운트
    for s in STOCKS:
        if s.get("dart_corp_code"):
            cnt = turso_one(
                "SELECT COUNT(*) as cnt FROM financials f JOIN stocks s ON f.stock_id=s.id WHERE s.ticker=?",
                [s["ticker"]]
            )
            print(f"  📊 financials [{s['ticker']}]: {cnt[0]['cnt']}행")


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  GSF-Investor seed_portfolio.py — Phase 1 Day 3")
    print(f"  Turso: {http_url}")
    print("=" * 60)

    # 연결 테스트
    try:
        rows = turso_one("SELECT sqlite_version() AS v")
        print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")
    except Exception as e:
        print(f"\n[ERROR] Turso 연결 실패: {e}")
        sys.exit(1)

    ticker_to_id = seed_stocks()
    seed_init_journal(ticker_to_id)
    seed_prices(ticker_to_id)
    seed_exchange_rates()
    seed_financials(ticker_to_id)
    verify_portfolio()

    print("\n" + "=" * 60)
    print("  ✅ 시딩 완료!")
    print("  ⚠️  HOLDINGS 섹션의 quantity/price가 0인 항목은")
    print("     실제 값으로 수정 후 재실행해주세요.")
    print("=" * 60)


if __name__ == "__main__":
    main()
