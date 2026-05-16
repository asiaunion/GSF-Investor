#!/usr/bin/env python3
"""
GSF-Investor Phase 1 Day 6-7 — daily_price.py
===============================================
매일 KST 07:00 (UTC 22:00 전날) GitHub Actions 크론으로 실행.

수집 대상:
  - 동서(026960.KS), 미코(059090.KQ) 전일 종가
  - USDKRW=X 전일 환율

동작:
  1. Turso DB에서 활성 종목(is_active=1, yahoo_ticker IS NOT NULL) 조회
  2. Yahoo Finance에서 최근 5영업일 데이터 다운로드 → 전일자 추출
  3. prices 테이블에 INSERT OR IGNORE
  4. exchange_rates 테이블에 USDKRW INSERT OR IGNORE
  5. 결과 요약 출력 (GitHub Actions 로그)

환경변수 (GitHub Secrets):
  TURSO_DATABASE_URL  예) libsql://xxx.turso.io
  TURSO_AUTH_TOKEN    예) eyJ...

실행:
  python3 scripts/daily_price.py
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

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 없습니다.")
    sys.exit(1)

# libsql:// → https://
http_url = TURSO_URL.replace("libsql://", "https://")

# ──────────────────────────────────────────────────────────────────────────────
# 1. Turso HTTP 헬퍼 (seed_portfolio.py와 동일 패턴)
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
# 2. 활성 종목 조회
# ──────────────────────────────────────────────────────────────────────────────

def fetch_active_stocks() -> list:
    """
    Turso에서 is_active=1이고 yahoo_ticker가 있는 종목 반환.
    반환: [{"stock_id": 1, "ticker": "026960", "yahoo_ticker": "026960.KS", "currency": "KRW"}, ...]
    """
    rows = turso_one(
        """SELECT id AS stock_id, ticker, yahoo_ticker, market
           FROM stocks
           WHERE is_active = 1 AND yahoo_ticker IS NOT NULL"""
    )
    result = []
    for r in rows:
        currency = "USD" if r.get("market") == "US" else "KRW"
        result.append({
            "stock_id": int(r["stock_id"]),
            "ticker":   r["ticker"],
            "yahoo_ticker": r["yahoo_ticker"],
            "currency": currency,
        })
    return result


# ──────────────────────────────────────────────────────────────────────────────
# 3. 주가 수집 및 저장
# ──────────────────────────────────────────────────────────────────────────────

def collect_prices(stocks: list) -> dict:
    """
    Yahoo Finance에서 각 종목의 전일 종가를 수집 → Turso INSERT OR IGNORE.
    반환: {"026960": {"date": "2026-05-15", "close": 28500.0, "inserted": True}, ...}
    """
    try:
        import yfinance as yf
    except ImportError:
        print("[ERROR] yfinance 미설치: pip3 install yfinance")
        sys.exit(1)

    today_kst = datetime.date.today()
    # KST 07:00 실행 시 "전일"은 어제 (한국 장 종료 기준)
    target_date = (today_kst - datetime.timedelta(days=1)).strftime("%Y-%m-%d")

    results = {}
    stmts = []

    for s in stocks:
        yahoo_sym = s["yahoo_ticker"]
        print(f"  📥 {yahoo_sym} ({s['ticker']}) 조회 중...", end=" ", flush=True)
        try:
            # 최근 5일치 → 전일 데이터 안정적 확보
            hist = yf.download(
                yahoo_sym,
                period="5d",
                auto_adjust=True,
                progress=False,
            )
            if hist.empty:
                print("데이터 없음")
                results[s["ticker"]] = {"error": "empty"}
                continue

            # 가장 최근 행 = 전일 종가
            latest = hist.iloc[-1]
            latest_date = hist.index[-1].strftime("%Y-%m-%d")

            close = float(latest["Close"].item()) if hasattr(latest["Close"], "item") else float(latest["Close"])
            volume_raw = latest["Volume"]
            volume = int(volume_raw.item()) if hasattr(volume_raw, "item") else int(volume_raw)

            print(f"✅ {latest_date} close={close:,.0f}")

            stmts.append({
                "q": """INSERT OR IGNORE INTO prices
                        (stock_id, date, close_price, volume, dividend, currency)
                        VALUES (?,?,?,?,?,?)""",
                "params": [s["stock_id"], latest_date, close, volume, 0.0, s["currency"]],
            })
            results[s["ticker"]] = {
                "date":   latest_date,
                "close":  close,
                "volume": volume,
            }
        except Exception as e:
            print(f"[ERROR] {e}")
            results[s["ticker"]] = {"error": str(e)}
        
        time.sleep(0.3)  # Yahoo Finance 부하 분산

    if stmts:
        inserted = turso_batch(stmts)
        print(f"\n  ✅ prices 신규 삽입: {inserted}행 (INSERT OR IGNORE 기준)")
    else:
        print("\n  ⚠️  prices 삽입 건 없음")

    return results


# ──────────────────────────────────────────────────────────────────────────────
# 4. 환율 수집 및 저장
# ──────────────────────────────────────────────────────────────────────────────

def collect_exchange_rate() -> dict:
    """
    Yahoo Finance USDKRW=X 전일 종가 → exchange_rates INSERT OR IGNORE.
    반환: {"date": "2026-05-15", "rate": 1380.5, "inserted": True}
    """
    try:
        import yfinance as yf
    except ImportError:
        print("[ERROR] yfinance 미설치")
        sys.exit(1)

    print("  📥 USDKRW=X 환율 조회 중...", end=" ", flush=True)
    try:
        hist = yf.download("USDKRW=X", period="5d", auto_adjust=True, progress=False)
        if hist.empty:
            print("데이터 없음")
            return {"error": "empty"}

        latest = hist.iloc[-1]
        latest_date = hist.index[-1].strftime("%Y-%m-%d")
        rate = float(latest["Close"].item()) if hasattr(latest["Close"], "item") else float(latest["Close"])

        print(f"✅ {latest_date} rate={rate:.2f}")

        stmt = [{
            "q": """INSERT OR IGNORE INTO exchange_rates (pair, date, rate)
                    VALUES (?,?,?)""",
            "params": ["USDKRW", latest_date, rate],
        }]
        inserted = turso_batch(stmt)

        return {
            "date":     latest_date,
            "rate":     rate,
            "inserted": inserted > 0,
        }
    except Exception as e:
        print(f"[ERROR] {e}")
        return {"error": str(e)}


# ──────────────────────────────────────────────────────────────────────────────
# 5. 결과 요약 출력
# ──────────────────────────────────────────────────────────────────────────────

def print_summary(price_results: dict, fx_result: dict) -> None:
    print("\n" + "=" * 55)
    print("  📊 daily_price.py 실행 결과 요약")
    print("=" * 55)

    print("\n  [주가]")
    for ticker, r in price_results.items():
        if "error" in r:
            print(f"  ❌ {ticker}: {r['error']}")
        else:
            status = "신규" if r.get("inserted", True) else "기존(SKIP)"
            print(f"  ✅ {ticker}: {r['date']} | close={r['close']:,.0f} | vol={r['volume']:,}")

    print("\n  [환율]")
    if "error" in fx_result:
        print(f"  ❌ USDKRW: {fx_result['error']}")
    else:
        status = "신규" if fx_result.get("inserted") else "기존(SKIP)"
        print(f"  ✅ USDKRW: {fx_result['date']} | rate={fx_result['rate']:.2f} | {status}")

    print("\n" + "=" * 55)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    run_ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("=" * 55)
    print(f"  GSF-Investor daily_price.py — {run_ts}")
    print(f"  Turso: {http_url}")
    print("=" * 55)

    # 연결 테스트
    try:
        rows = turso_one("SELECT sqlite_version() AS v")
        print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")
    except Exception as e:
        print(f"\n[ERROR] Turso 연결 실패: {e}")
        sys.exit(1)

    # 활성 종목 조회
    stocks = fetch_active_stocks()
    if not stocks:
        print("[WARN] 활성 종목이 없습니다. stocks 테이블을 확인하세요.")
        sys.exit(0)
    print(f"✅ 활성 종목 {len(stocks)}개: {[s['ticker'] for s in stocks]}\n")

    # 주가 수집
    print("[STEP 1] 주가 수집")
    price_results = collect_prices(stocks)

    # 환율 수집
    print("\n[STEP 2] 환율 수집")
    fx_result = collect_exchange_rate()

    # 결과 요약
    print_summary(price_results, fx_result)

    # 오류가 하나라도 있으면 exit code 1 (GitHub Actions에서 실패 표시)
    has_error = any("error" in r for r in price_results.values()) or "error" in fx_result
    if has_error:
        print("\n⚠️  일부 수집 실패 — GitHub Actions에서 경고로 처리됩니다.")
        sys.exit(1)


if __name__ == "__main__":
    main()
