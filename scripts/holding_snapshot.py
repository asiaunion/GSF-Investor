#!/usr/bin/env python3
"""
GSF-Investor — scripts/holding_snapshot.py
=========================================
매일 KST 18:00 (평일 장 마감 후) GitHub Actions 크론으로 실행 가능.
현재 보유 포트폴리오의 종가 및 환율을 반영하여 holding_snapshots 일별 테이블에 평가액과 PnL 스냅샷을 기록합니다.

환경변수:
  TURSO_DATABASE_URL  예) libsql://xxx.turso.io 또는 file:local.db
  TURSO_AUTH_TOKEN    예) eyJ...
  REAL_DATA_RUN_ACK   원격 Turso 쓰기 시 'I_ACK_PROD_WRITE' 필수
  DRY_RUN             1인 경우 외부 API나 DB 쿼리 조회는 하되, 쓰기/수정 동작 생략
"""

import os
import sys
import datetime
import requests
from typing import List, Dict, Any

# real_data_guard 임포트를 위해 경로 추가
_script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _script_dir)

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

load_dotenv(os.path.join(_script_dir, "..", ".env.local"))
load_dotenv(os.path.join(_script_dir, "..", ".env"))

from real_data_guard import enforce_remote_write_guard, is_dry_run, log_dry_run_skipped_writes

TURSO_URL   = os.environ.get("TURSO_DATABASE_URL", "").strip()
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "").strip()

if not TURSO_URL:
    print("[ERROR] TURSO_DATABASE_URL 환경변수가 없습니다.")
    sys.exit(1)

# libsql:// -> https://
http_url = TURSO_URL.replace("libsql://", "https://")

# ──────────────────────────────────────────────────────────────────────────────
# Turso HTTP API 헬퍼
# ──────────────────────────────────────────────────────────────────────────────

def _encode_param(p):
    """Python 값 -> Turso typed arg"""
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
    if not TURSO_TOKEN:
        raise ValueError("TURSO_AUTH_TOKEN이 없습니다. 원격 Turso 연결에 필수적입니다.")
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
    """단일 쿼리 -> rows 리스트 반환"""
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
    """여러 쿼리를 200개씩 나눠 실행 -> 삽입 성공 건수 반환"""
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
# 로컬 / 원격 통합 쿼리 인터페이스
# ──────────────────────────────────────────────────────────────────────────────

def query_db(sql: str, params: list = None) -> list:
    """로컬 sqlite3 또는 원격 Turso를 구분하여 단일 쿼리 실행"""
    if TURSO_URL.startswith("file:"):
        db_path = TURSO_URL.replace("file:", "")
        # 상대 경로 처리 (ROOT 기준)
        if not os.path.isabs(db_path):
            db_path = os.path.abspath(os.path.join(_script_dir, "..", db_path))
        import sqlite3
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql, params or [])
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    else:
        return turso_one(sql, params)


def execute_batch(statements: list) -> int:
    """로컬 sqlite3 또는 원격 Turso에 배치 쿼리 실행 (Dry Run 검증 포함)"""
    if not statements:
        return 0

    if is_dry_run():
        sample = statements[0].get("q")
        log_dry_run_skipped_writes(stmt_count=len(statements), sample_sql=sample)
        return 0

    if TURSO_URL.startswith("file:"):
        db_path = TURSO_URL.replace("file:", "")
        if not os.path.isabs(db_path):
            db_path = os.path.abspath(os.path.join(_script_dir, "..", db_path))
        import sqlite3
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        affected = 0
        for s in statements:
            cur.execute(s["q"], s.get("params", []))
            affected += cur.rowcount
        conn.commit()
        conn.close()
        return affected
    else:
        return turso_batch(statements)


# ──────────────────────────────────────────────────────────────────────────────
# 메인 로직
# ──────────────────────────────────────────────────────────────────────────────

def main():
    # 원격 데이터베이스 쓰기 가드 실행
    enforce_remote_write_guard(database_url=TURSO_URL, script_name="holding_snapshot.py")

    kst = datetime.timezone(datetime.timedelta(hours=9))
    today_str = datetime.datetime.now(kst).strftime("%Y-%m-%d")

    print("=" * 60)
    print(f"  GSF-Investor holding_snapshot.py — {today_str} KST")
    print(f"  Database URL: {TURSO_URL}")
    print("=" * 60)

    # 1. v_portfolio에서 보유 포지션 조회
    try:
        portfolio_rows = query_db(
            "SELECT stock_id, ticker, name, market, quantity, avg_price, currency FROM v_portfolio"
        )
    except Exception as e:
        print(f"[ERROR] v_portfolio 조회 실패 (혹시 뷰가 생성되지 않았거나 DB 설정 문제): {e}")
        sys.exit(1)

    if not portfolio_rows:
        print("[WARN] 현재 보유 중인 종목이 포트폴리오에 없습니다. 작업을 종료합니다.")
        sys.exit(0)

    print(f"✅ 보유 종목 {len(portfolio_rows)}개 조회 완료.")

    # 2. 최신 USDKRW 환율 조회
    try:
        fx_rows = query_db(
            "SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1"
        )
        if fx_rows:
            usdkrw_rate = float(fx_rows[0]["rate"])
        else:
            usdkrw_rate = 1350.0
            print("[WARN] exchange_rates 테이블에 USDKRW 환율이 없습니다. 기본값 1350.0을 사용합니다.")
    except Exception as e:
        usdkrw_rate = 1350.0
        print(f"[WARN] 환율 조회 실패로 인해 기본값 1350.0을 사용합니다: {e}")

    print(f"✅ 사용 환율: USDKRW = {usdkrw_rate:.2f}")

    # 3. 각 종목별 최신 종가 조회
    try:
        price_rows = query_db(
            """
            SELECT stock_id, close_price 
            FROM prices 
            WHERE (stock_id, date) IN (
                SELECT stock_id, MAX(date) 
                FROM prices 
                GROUP BY stock_id
            )
            """
        )
        latest_prices = {int(p["stock_id"]): float(p["close_price"]) for p in price_rows}
    except Exception as e:
        print(f"[ERROR] 최신 가격 조회 실패: {e}")
        sys.exit(1)

    # 4. 스냅샷 데이터 생성 및 배치 삽입 쿼리 구성
    statements = []
    print("\n  [보유 종목 평가 스냅샷 계산]")
    
    for pos in portfolio_rows:
        stock_id = int(pos["stock_id"])
        ticker = pos["ticker"]
        name = pos["name"]
        quantity = float(pos["quantity"])
        avg_price = float(pos["avg_price"])
        currency = pos["currency"] or "KRW"

        market_price = latest_prices.get(stock_id)
        if market_price is None:
            print(f"  ⚠️  {ticker} ({name}): 가격 데이터가 prices 테이블에 존재하지 않아 스냅샷에서 제외됩니다.")
            continue

        # 원화 가치 및 손익 계산
        if currency == "USD":
            market_value_krw = quantity * market_price * usdkrw_rate
            unrealized_pnl_krw = quantity * (market_price - avg_price) * usdkrw_rate
        else:
            market_value_krw = quantity * market_price
            unrealized_pnl_krw = quantity * (market_price - avg_price)

        print(f"  - {ticker} ({name}): Qty={quantity:.2f} | Avg={avg_price:,.2f} | MarketPrice={market_price:,.2f} | ValueKRW={market_value_krw:,.0f} | PnLKRW={unrealized_pnl_krw:,.0f} ({currency})")

        statements.append({
            "q": """
                INSERT OR REPLACE INTO holding_snapshots
                (stock_id, date, quantity, avg_price, market_price, market_value_krw, unrealized_pnl_krw, currency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            "params": [
                stock_id,
                today_str,
                quantity,
                avg_price,
                market_price,
                market_value_krw,
                unrealized_pnl_krw,
                currency
            ]
        })

    # 5. DB 배치 쓰기 실행
    if statements:
        affected = execute_batch(statements)
        print(f"\n✅ holding_snapshots 신규/갱신 스냅샷 적재 완료: {affected}행 처리됨.")
    else:
        print("\n⚠️ 적재할 스냅샷 행이 없습니다.")

if __name__ == "__main__":
    main()
