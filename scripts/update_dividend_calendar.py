#!/usr/bin/env python3
"""
GSF-Investor Phase 2b — update_dividend_calendar.py
===================================================
활성 종목의 2024년 1월 1일 이후 배당락(ex_date) 정보를 yfinance로부터 수집하여
dividend_events 테이블에 적재하는 백엔드 스크립트.

특징:
  1. real_data_guard.py의 enforce_remote_write_guard를 준수하여 remote Turso DB 쓰기 통제.
  2. yfinance를 통한 한국(KR), 미국(US) 및 일본(JP) 주식의 배당락일 및 배당금액 수집.
  3. pay_date는 yfinance가 제공하지 않으므로 SQL NULL(None)로 적재.
  4. uq_dividend_events (stock_id, ex_date, pay_date) 인덱스 및 SQLite UNIQUE NULL 특성에
     대응하여 DB에 이미 적재된 (stock_id, ex_date)를 사전 조회 후 신규 데이터만 안전하게 필터링 및 적재 (이중 필터링).
  5. DRY_RUN=1을 지원하여 실제 적재를 생략하고 시뮬레이션 결과만 로깅 가능.
"""

import os
import sys
import datetime
import time
from typing import Optional, List, Dict, Any
import requests

# ──────────────────────────────────────────────────────────────────────────────
# 0. .env.local 로드 및 안전 장치 모듈 임포트
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

sys.path.insert(0, _script_dir)
try:
    from real_data_guard import enforce_remote_write_guard, is_dry_run, log_dry_run_skipped_writes
except ImportError:
    print("[ERROR] real_data_guard.py 모듈을 찾을 수 없습니다. scripts/ 디렉토리에 존재하는지 확인하세요.")
    sys.exit(1)

TURSO_URL   = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 누락되었습니다.")
    sys.exit(1)

# libsql:// → https://
http_url = TURSO_URL.replace("libsql://", "https://")


# ──────────────────────────────────────────────────────────────────────────────
# 1. Turso HTTP API 통신 헬퍼
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
    if is_dry_run():
        sample = statements[0].get("q")
        log_dry_run_skipped_writes(stmt_count=len(statements), sample_sql=sample)
        return 0
    inserted = 0
    chunk_size = 200
    for i in range(0, len(statements), chunk_size):
        chunk = statements[i : i + chunk_size]
        results = turso_exec(chunk)
        for r in results:
            if r.get("type") == "error":
                print(f"  [WARN] 배치 실행 오류: {r}")
            else:
                resp = r.get("response", {}).get("result", {})
                inserted += resp.get("affected_row_count", 0)
    return inserted


# ──────────────────────────────────────────────────────────────────────────────
# 2. 메인 비즈니스 로직
# ──────────────────────────────────────────────────────────────────────────────

def fetch_active_stocks() -> list:
    """
    Turso에서 활성 종목 조회 (is_active=1 및 yahoo_ticker가 존재하는 종목)
    """
    rows = turso_one(
        """SELECT id AS stock_id, ticker, yahoo_ticker, market
           FROM stocks
           WHERE is_active = 1 AND yahoo_ticker IS NOT NULL"""
    )
    result = []
    for r in rows:
        # market에 따른 배당 기본 통화 설정
        m = str(r.get("market")).upper()
        if m == "US":
            currency = "USD"
        elif m == "JP":
            currency = "JPY"
        else:
            currency = "KRW"
            
        result.append({
            "stock_id": int(r["stock_id"]),
            "ticker":   r["ticker"],
            "yahoo_ticker": r["yahoo_ticker"],
            "currency": currency,
            "market": m
        })
    return result


def get_existing_dividend_dates(stock_id: int) -> set:
    """
    이미 DB의 dividend_events 테이블에 적재되어 있는 ex_date(배당락일) 목록을 가져옵니다.
    중복 적재 방지를 위한 캐싱 용도.
    """
    rows = turso_one(
        "SELECT ex_date FROM dividend_events WHERE stock_id = ?",
        [stock_id]
    )
    return {r["ex_date"] for r in rows if r.get("ex_date")}


def collect_dividends_for_stock(stock: dict) -> list:
    """
    yfinance를 활용하여 1개 종목에 대한 2024-01-01 이후의 배당 이력을 획득합니다.
    """
    import yfinance as yf
    import pandas as pd
    
    yahoo_ticker = stock["yahoo_ticker"]
    stock_id = stock["stock_id"]
    currency = stock["currency"]
    
    print(f"  📥 {yahoo_ticker} (stock_id: {stock_id}) 배당 이력 수집 중...", end=" ", flush=True)
    
    try:
        ticker_obj = yf.Ticker(yahoo_ticker)
        dividends = ticker_obj.dividends
        
        if dividends is None or dividends.empty:
            print("❌ 배당 데이터 없음")
            return []
            
        # 2024년 1월 1일 이후의 배당락일 데이터만 필터링
        cutoff_date = pd.Timestamp("2024-01-01", tz=dividends.index.tz)
        filtered_divs = dividends[dividends.index >= cutoff_date]
        
        if filtered_divs.empty:
            print("⚠️ 2024년 1월 1일 이후의 배당 이력 없음")
            return []
            
        events = []
        for dt, val in filtered_divs.items():
            ex_date_str = dt.strftime("%Y-%m-%d")
            amount = float(val)
            
            # 0원 이하 배당은 무시
            if amount <= 0:
                continue
                
            events.append({
                "stock_id": stock_id,
                "ex_date": ex_date_str,
                "pay_date": None,  # yfinance는 pay_date를 제공하지 않음
                "amount_per_share": amount,
                "currency": currency,
                "source": "YAHOO"
            })
            
        print(f"✅ {len(events)}건 발견")
        return events
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return []


def main():
    enforce_remote_write_guard(database_url=TURSO_URL, script_name="update_dividend_calendar.py")
    
    run_ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("=" * 65)
    print(f"  GSF-Investor update_dividend_calendar.py — {run_ts}")
    print(f"  Turso: {http_url}")
    if is_dry_run():
        print("  ⚠️ DRY_RUN=1 모드 (실제 DB 쓰기 생략)")
    print("=" * 65)

    # 1. 연결 테스트
    try:
        rows = turso_one("SELECT sqlite_version() AS v")
        print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")
    except Exception as e:
        print(f"\n[ERROR] Turso 연결 실패: {e}")
        sys.exit(1)

    # 2. 활성 종목 조회
    stocks = fetch_active_stocks()
    if not stocks:
        print("[WARN] 활성 종목이 없습니다. stocks 테이블을 확인해 주세요.")
        sys.exit(0)
    print(f"✅ 활성 종목 {len(stocks)}개: {[s['ticker'] for s in stocks]}\n")

    # 3. 각 종목에 대한 배당금 수집 및 DB 중복 체크 후 배치 쿼리 생성
    total_found_events = 0
    all_insert_stmts = []
    summary_details = []
    
    import yfinance as yf # yfinance 가 정상 Import 되는지 사전 확인
    
    print("[STEP 1] 종목별 배당 데이터 수집 및 이중 중복 검사")
    for s in stocks:
        existing_dates = get_existing_dividend_dates(s["stock_id"])
        collected_events = collect_dividends_for_stock(s)
        
        new_events = []
        duplicate_count = 0
        
        for ev in collected_events:
            if ev["ex_date"] in existing_dates:
                duplicate_count += 1
            else:
                new_events.append(ev)
                
        total_found_events += len(collected_events)
        
        # 신규 이벤트에 대해 INSERT statement 작성
        for ev in new_events:
            all_insert_stmts.append({
                "q": """INSERT INTO dividend_events 
                        (stock_id, ex_date, pay_date, amount_per_share, currency, source)
                        VALUES (?, ?, ?, ?, ?, ?)""",
                "params": [
                    ev["stock_id"],
                    ev["ex_date"],
                    ev["pay_date"],
                    ev["amount_per_share"],
                    ev["currency"],
                    ev["source"]
                ]
            })
            
        summary_details.append({
            "ticker": s["ticker"],
            "yahoo_ticker": s["yahoo_ticker"],
            "found": len(collected_events),
            "duplicates": duplicate_count,
            "new": len(new_events),
            "currency": s["currency"]
        })
        time.sleep(0.5)  # API 요청 부하 조절

    # 4. 프로덕션 DB에 반영
    print("\n[STEP 2] Turso DB에 신규 배당 일정 적재")
    inserted_count = 0
    if all_insert_stmts:
        inserted_count = turso_batch(all_insert_stmts)
        print(f"  ✅ dividend_events 신규 삽입 완료: {inserted_count}행")
    else:
        print("  ⚠️ 적재할 신규 배당 데이터가 없습니다.")

    # 5. 결과 요약 보고
    print("\n" + "=" * 65)
    print("  📊 update_dividend_calendar.py 실행 요약")
    print("=" * 65)
    print(f"  - 조회 완료 종목: {len(stocks)}개")
    print(f"  - 수집된 배당 일정: {total_found_events}건 (2024년 1월 1일 이후)")
    print(f"  - 중복 차단: {sum(x['duplicates'] for x in summary_details)}건")
    print(f"  - DB 적재 시도: {len(all_insert_stmts)}건")
    print(f"  - 최종 DB 반영: {inserted_count}건")
    print("\n  [상세 종목별 수집 결과]")
    for sd in summary_details:
        print(f"  • {sd['ticker']} ({sd['yahoo_ticker']}): 수집={sd['found']}건 | 중복={sd['duplicates']}건 | 신규={sd['new']}건 | 통화={sd['currency']}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
