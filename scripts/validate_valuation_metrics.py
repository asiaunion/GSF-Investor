#!/usr/bin/env python3
"""
Layer 3: Recompute PER, PBR, dividend yield, ROE from DB vs stock API.

Examples:
  python3 scripts/validate_valuation_metrics.py --ticker 026960 --db-only
  python3 scripts/validate_valuation_metrics.py --tickers 026960,059090 --base-url http://localhost:3000
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Any, Optional

from financial_validation_lib import (
    init_env,
    recompute_roe,
    turso_http_url,
    turso_query,
)

PILOT_TICKERS = ["026960", "059090", "069500"]
METRICS = ["per", "pbr", "dividend_yield", "roe"]
REL_TOL = 0.005


def num(v) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def metrics_close(a: Optional[float], b: Optional[float]) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    denom = max(abs(a), abs(b), 1e-9)
    return abs(a - b) / denom <= REL_TOL or abs(a - b) <= 0.05


def load_stock_bundle(http_url: str, token: str, ticker: str) -> Optional[dict]:
    stocks = turso_query(
        http_url,
        token,
        "SELECT id, ticker, market FROM stocks WHERE ticker = ? AND is_active = 1 LIMIT 1",
        [ticker],
    )
    if not stocks:
        return None
    stock_id = int(stocks[0]["id"])

    price_rows = turso_query(
        http_url,
        token,
        """
        SELECT close_price, date FROM prices
        WHERE stock_id = ?
        ORDER BY date DESC LIMIT 1
        """,
        [stock_id],
    )
    fy_rows = turso_query(
        http_url,
        token,
        """
        SELECT period, eps, bps, net_income, total_equity, dividend_per_share, roe
        FROM financials
        WHERE stock_id = ? AND period LIKE '%FY'
        ORDER BY period DESC LIMIT 1
        """,
        [stock_id],
    )
    return {
        "stock_id": stock_id,
        "ticker": ticker,
        "price": price_rows[0] if price_rows else None,
        "fy": fy_rows[0] if fy_rows else None,
    }


def recompute_metrics(bundle: dict) -> dict[str, Any]:
    price_row = bundle.get("price")
    fy = bundle.get("fy")
    price = num(price_row["close_price"]) if price_row else None
    price_date = price_row.get("date") if price_row else None

    if not fy:
        return {
            "price": price,
            "price_date": price_date,
            "fy_period": None,
            "per": None,
            "pbr": None,
            "dividend_yield": None,
            "roe": None,
        }

    eps = num(fy.get("eps"))
    bps = num(fy.get("bps"))
    dps = num(fy.get("dividend_per_share"))
    net_income = num(fy.get("net_income"))
    total_equity = num(fy.get("total_equity"))
    roe_stored = num(fy.get("roe"))

    per = price / eps if price and eps and eps > 0 else None
    pbr = price / bps if price and bps and bps > 0 else None
    div_yield = (dps / price * 100) if price and dps and dps > 0 else None
    roe = roe_stored if roe_stored is not None else recompute_roe(net_income, total_equity)

    return {
        "price": price,
        "price_date": price_date,
        "fy_period": fy.get("period"),
        "per": per,
        "pbr": pbr,
        "dividend_yield": div_yield,
        "roe": roe,
    }


def fetch_api_overview(base_url: str, ticker: str, cookie: Optional[str]) -> Optional[dict]:
    url = f"{base_url.rstrip('/')}/api/stocks/{ticker}"
    req = urllib.request.Request(url)
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status != 200:
                return None
            data = json.loads(resp.read().decode())
            return data.get("overview")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"  [WARN] API 401 for {ticker} — use --db-only or provide session cookie")
        return None
    except Exception as e:
        print(f"  [WARN] API fetch failed: {e}")
        return None


def validate_ticker(
    http_url: str,
    token: str,
    ticker: str,
    base_url: Optional[str],
    cookie: Optional[str],
    db_only: bool,
) -> list[dict]:
    bundle = load_stock_bundle(http_url, token, ticker)
    if not bundle:
        return [{"ticker": ticker, "metric": "*", "status": "SKIP", "note": "stock not found"}]

    calc = recompute_metrics(bundle)
    results: list[dict] = []

    api_ov = None if db_only else fetch_api_overview(base_url or "", ticker, cookie)
    api_map = {
        "per": num(api_ov.get("per")) if api_ov else None,
        "pbr": num(api_ov.get("pbr")) if api_ov else None,
        "dividend_yield": num(api_ov.get("dividendYield")) if api_ov else None,
        "roe": None,
    }
    fy_row = bundle.get("fy")
    if api_ov and fy_row:
        api_map["roe"] = recompute_roe(num(fy_row.get("net_income")), num(fy_row.get("total_equity")))

    for metric in METRICS:
        recalc = calc.get(metric if metric != "dividend_yield" else "dividend_yield")
        api_val = api_map.get(metric)
        if db_only:
            status = "PASS" if recalc is not None else "SKIP"
            results.append(
                {
                    "ticker": ticker,
                    "metric": metric,
                    "status": status,
                    "recomputed": recalc,
                    "api": None,
                    "fy_period": calc.get("fy_period"),
                    "price_date": calc.get("price_date"),
                }
            )
            continue
        if api_val is None and recalc is None:
            status = "SKIP"
        elif metrics_close(recalc, api_val):
            status = "PASS"
        else:
            status = "FAIL"
        results.append(
            {
                "ticker": ticker,
                "metric": metric,
                "status": status,
                "recomputed": recalc,
                "api": api_val,
                "fy_period": calc.get("fy_period"),
                "price_date": calc.get("price_date"),
            }
        )

    print(f"\n--- {ticker} L3 (FY={calc.get('fy_period')} price_date={calc.get('price_date')}) ---")
    for r in results:
        sym = "✓" if r["status"] == "PASS" else ("?" if r["status"] == "SKIP" else "✗")
        print(
            f"  {sym} {r['metric']}: recalc={r.get('recomputed')} api={r.get('api')} [{r['status']}]"
        )
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate valuation metrics (L3)")
    parser.add_argument("--ticker")
    parser.add_argument("--tickers")
    parser.add_argument("--all-active", action="store_true")
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--cookie", help="Session cookie for authenticated API")
    parser.add_argument("--db-only", action="store_true", help="Recompute only, no API compare")
    args = parser.parse_args()

    if args.all_active:
        turso_url, turso_token, _ = init_env()
        http_url = turso_http_url(turso_url)
        rows = turso_query(
            http_url,
            turso_token,
            "SELECT ticker FROM stocks WHERE is_active = 1 ORDER BY ticker",
        )
        tickers = [r["ticker"] for r in rows]
    elif args.tickers:
        tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
    elif args.ticker:
        tickers = [args.ticker]
    else:
        tickers = PILOT_TICKERS

    turso_url, turso_token, _ = init_env()
    http_url = turso_http_url(turso_url)

    all_results: list[dict] = []
    for t in tickers:
        all_results.extend(
            validate_ticker(
                http_url,
                turso_token,
                t,
                args.base_url,
                args.cookie,
                args.db_only,
            )
        )

    fails = [r for r in all_results if r.get("status") == "FAIL"]
    print(f"\n=== L3 Summary: PASS={sum(1 for r in all_results if r.get('status')=='PASS')} "
          f"FAIL={len(fails)} SKIP={sum(1 for r in all_results if r.get('status')=='SKIP')}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
