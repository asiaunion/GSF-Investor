#!/usr/bin/env python3
"""
GSF-Investor Phase 1 Day 6-7 — daily_price.py (Phase A3: data_provider 어댑터 통합)
=====================================================================================
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

실데이터 안전 장치:
  REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE — 원격 Turso에 쓰기 전 필수 (로컬 file: 제외).
  DRY_RUN=1 — 배치 INSERT/REPLACE는 생략(조회 및 외부 API 호출 동작 확인용).

실행:
  python3 scripts/daily_price.py
"""

import os
import sys
import json
import time
import datetime
from typing import Optional
import requests

# Phase A3: 어댑터 패턴 — Yahoo Finance 실패 시 FMP 폴백
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from data_provider import get_price as _dp_get_price, get_fx_rate as _dp_get_fx
    DATA_PROVIDER_AVAILABLE = True
except ImportError:
    DATA_PROVIDER_AVAILABLE = False
    print("[WARN] data_provider.py 미발견 — yfinance 직접 호출 모드")

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

from real_data_guard import enforce_remote_write_guard, is_dry_run, log_dry_run_skipped_writes

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
    data_provider 어댑터를 통해 주가 수집 (Yahoo → FMP 폴백) → Turso INSERT OR REPLACE.
    반환: {"026960": {"date": "2026-05-15", "close": 28500.0, "source": "yahoo"}, ...}
    """
    results = {}
    stmts = []

    for s in stocks:
        yahoo_sym = s["yahoo_ticker"]

        if DATA_PROVIDER_AVAILABLE:
            # 어댑터 패턴: Yahoo 실패 시 FMP 자동 폴백
            r = _dp_get_price(yahoo_sym, s["currency"])
        else:
            # data_provider 미존재 시 직접 yfinance 호출 (레거시)
            r = _legacy_yahoo_get(yahoo_sym)

        if r is None:
            results[s["ticker"]] = {"error": "all_providers_failed"}
            continue

        close       = r["close"]
        latest_date = r["date"]
        source      = r.get("source", "unknown")

        stmts.append({
            "q": """INSERT OR REPLACE INTO prices
                    (stock_id, date, close_price, volume, dividend, currency)
                    VALUES (?,?,?,?,?,?)""",
            "params": [s["stock_id"], latest_date, close, 0, 0.0, s["currency"]],
        })
        results[s["ticker"]] = {
            "date":   latest_date,
            "close":  close,
            "source": source,
        }
        time.sleep(0.3)

    if stmts:
        inserted = turso_batch(stmts)
        print(f"\n  ✅ prices 신규/갱신 삽입: {inserted}행")
    else:
        print("\n  ⚠️  prices 삽입 건 없음")

    return results


def _legacy_yahoo_get(yahoo_sym: str) -> Optional[dict]:
    """data_provider 없을 때 직접 yfinance 호출 (레거시 폴백)"""
    try:
        import yfinance as yf
        import pandas as pd
        hist = yf.download(yahoo_sym, period="5d", auto_adjust=True, progress=False)
        if hist is None or hist.empty:
            return None
        if isinstance(hist.columns, pd.MultiIndex):
            hist.columns = hist.columns.droplevel(1)
        latest = hist.iloc[-1]
        date  = hist.index[-1].strftime("%Y-%m-%d")
        close = float(latest["Close"].item()) if hasattr(latest["Close"], "item") else float(latest["Close"])
        return {"close": close, "date": date, "source": "yahoo_legacy"}
    except Exception as e:
        print(f"[LEGACY/yahoo] {yahoo_sym}: {e}")
        return None


# ──────────────────────────────────────────────────────────────────────────────
# 4. 환율 수집 및 저장
# ──────────────────────────────────────────────────────────────────────────────

def _collect_fx_pair(pair: str) -> dict:
    """단일 환율 pair → exchange_rates INSERT OR IGNORE."""
    if DATA_PROVIDER_AVAILABLE:
        r = _dp_get_fx(pair)
    elif pair == "USDKRW":
        try:
            import yfinance as yf
            import pandas as pd
            hist = yf.download("USDKRW=X", period="5d", auto_adjust=True, progress=False)
            if hist.empty:
                return {"pair": pair, "error": "empty"}
            if isinstance(hist.columns, pd.MultiIndex):
                hist.columns = hist.columns.droplevel(1)
            latest = hist.iloc[-1]
            rate = float(latest["Close"].item()) if hasattr(latest["Close"], "item") else float(latest["Close"])
            r = {"rate": rate, "date": hist.index[-1].strftime("%Y-%m-%d"), "source": "yahoo_legacy"}
        except Exception as e:
            return {"pair": pair, "error": str(e)}
    else:
        return {"pair": pair, "error": "data_provider_required"}

    if r is None:
        return {"pair": pair, "error": "all_providers_failed"}

    stmt = [{
        "q": "INSERT OR IGNORE INTO exchange_rates (pair, date, rate) VALUES (?,?,?)",
        "params": [pair, r["date"], r["rate"]],
    }]
    inserted = turso_batch(stmt)
    return {
        "pair":     pair,
        "date":     r["date"],
        "rate":     r["rate"],
        "source":   r.get("source", "unknown"),
        "inserted": inserted > 0,
    }


def collect_exchange_rates() -> dict:
    """USDKRW + JPYKRW 수집. JPY 실패는 경고만 (USD는 필수)."""
    usd = _collect_fx_pair("USDKRW")
    jpy = _collect_fx_pair("JPYKRW")
    return {"USDKRW": usd, "JPYKRW": jpy}


# ──────────────────────────────────────────────────────────────────────────────
# 5. 결과 요약 출력
# ──────────────────────────────────────────────────────────────────────────────

def print_summary(price_results: dict, fx_results: dict) -> None:
    print("\n" + "=" * 55)
    print("  📊 daily_price.py 실행 결과 요약")
    print("=" * 55)

    print("\n  [주가]")
    for ticker, r in price_results.items():
        if "error" in r:
            print(f"  ❌ {ticker}: {r['error']}")
        else:
            status = "신규" if r.get("inserted", True) else "기존(SKIP)"
            vol = r.get("volume", 0)
            print(f"  ✅ {ticker}: {r['date']} | close={r['close']:,.0f} | vol={vol:,}")

    print("\n  [환율]")
    for pair in ("USDKRW", "JPYKRW"):
        fx_result = fx_results.get(pair, {})
        if "error" in fx_result:
            mark = "⚠️ " if pair == "JPYKRW" else "❌"
            print(f"  {mark} {pair}: {fx_result['error']}")
        else:
            status = "신규" if fx_result.get("inserted") else "기존(SKIP)"
            print(f"  ✅ {pair}: {fx_result['date']} | rate={fx_result['rate']:.4f} | {status}")

    print("\n" + "=" * 55)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    enforce_remote_write_guard(database_url=TURSO_URL, script_name="daily_price.py")
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
    fx_results = collect_exchange_rates()

    # 결과 요약
    print_summary(price_results, fx_results)

    # 오류가 하나라도 있으면 exit code 1 (GitHub Actions에서 실패 표시)
    usd_fx = fx_results.get("USDKRW", {})
    has_error = any("error" in r for r in price_results.values()) or "error" in usd_fx
    if has_error:
        print("\n⚠️  일부 수집 실패 — GitHub Actions에서 경고로 처리됩니다.")
        sys.exit(1)


if __name__ == "__main__":
    main()
