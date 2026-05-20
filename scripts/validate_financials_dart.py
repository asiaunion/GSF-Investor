#!/usr/bin/env python3
"""
Layer 1–2: DART OpenAPI vs DB financials, plus stored-field recompute checks.

Examples:
  python3 scripts/validate_financials_dart.py --ticker 026960
  python3 scripts/validate_financials_dart.py --tickers 026960,059090,069500
  python3 scripts/validate_financials_dart.py --all-active
"""

from __future__ import annotations

import argparse
import sys
from typing import Optional

from financial_validation_lib import (
    DART_ACCOUNT_LABELS,
    amounts_close,
    build_acc_map,
    extract_dart_fields,
    fetch_dart_financials,
    init_env,
    period_to_dart,
    pick_dart_scale,
    recompute_bps,
    recompute_debt_ratio,
    recompute_eps,
    turso_http_url,
    turso_query,
)

L1_FIELDS = [
    "revenue",
    "op_income",
    "net_income",
    "total_assets",
    "total_equity",
    "dividend_per_share",
]

L2_FIELDS = ["eps", "bps", "debt_ratio"]

PILOT_TICKERS = ["026960", "059090", "069500"]


def num(v) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def compare_field(name: str, db_val: Optional[float], dart_val: Optional[float]) -> str:
    if db_val is None and dart_val is None:
        return "SKIP"
    if db_val is None or dart_val is None:
        return "FAIL"
    if amounts_close(db_val, dart_val, rel=0.001, abs_tol=1.0):
        return "PASS"
    if name == "debt_ratio" and amounts_close(db_val, dart_val, rel=0.01, abs_tol=1.0):
        return "PASS"
    return "FAIL"


def load_stocks(http_url: str, token: str, tickers: list[str] | None, all_active: bool) -> list[dict]:
    if all_active:
        sql = """
          SELECT id, ticker, name, dart_corp_code
          FROM stocks
          WHERE is_active = 1 AND dart_corp_code IS NOT NULL
          ORDER BY ticker
        """
        return turso_query(http_url, token, sql)
    placeholders = ",".join("?" * len(tickers))
    sql = f"""
      SELECT id, ticker, name, dart_corp_code
      FROM stocks
      WHERE ticker IN ({placeholders}) AND dart_corp_code IS NOT NULL
    """
    return turso_query(http_url, token, sql, tickers)


def load_financials(http_url: str, token: str, stock_id: int) -> list[dict]:
    sql = """
      SELECT period, revenue, op_income, net_income, total_assets, total_equity,
             debt_ratio, dividend_per_share, eps, bps, shares_outstanding, source
      FROM financials
      WHERE stock_id = ? AND source = 'DART'
      ORDER BY period DESC
    """
    return turso_query(http_url, token, sql, [stock_id])


def validate_row(
    dart_key: str,
    corp_code: str,
    row: dict,
    layer2_only: bool,
) -> list[dict]:
    period = row["period"]
    parsed = period_to_dart(period)
    results: list[dict] = []
    if not parsed:
        results.append(
            {"period": period, "layer": "L1", "field": "*", "status": "SKIP", "note": "unknown period"}
        )
        return results

    year, report_code = parsed
    data = fetch_dart_financials(dart_key, corp_code, year, report_code, "CFS")
    if not data:
        data = fetch_dart_financials(dart_key, corp_code, year, report_code, "OFS")
    if not data:
        results.append(
            {"period": period, "layer": "L1", "field": "*", "status": "SKIP", "note": "DART no data"}
        )
        return results

    acc_map = build_acc_map(data)
    scale = pick_dart_scale(row, extract_dart_fields(acc_map, "raw"))
    dart = extract_dart_fields(acc_map, scale)

    if not layer2_only:
        for field in L1_FIELDS:
            db_v = num(row.get(field))
            dart_v = dart.get(field) if field != "dividend_per_share" else dart.get("dividend_per_share")
            status = compare_field(field, db_v, dart_v)
            results.append(
                {
                    "period": period,
                    "layer": "L1",
                    "field": field,
                    "status": status,
                    "db": db_v,
                    "dart": dart_v,
                    "scale": scale,
                }
            )

    shares = num(row.get("shares_outstanding"))
    net_income = num(row.get("net_income"))
    total_equity = num(row.get("total_equity"))
    total_assets = num(row.get("total_assets"))

    stored_eps = num(row.get("eps"))
    calc_eps = recompute_eps(net_income, shares)
    results.append(
        {
            "period": period,
            "layer": "L2",
            "field": "eps",
            "status": compare_field("eps", stored_eps, calc_eps),
            "db": stored_eps,
            "dart": calc_eps,
            "note": "net_income/shares",
        }
    )

    stored_bps = num(row.get("bps"))
    calc_bps = recompute_bps(total_equity, shares, None)
    if stored_bps is not None and calc_bps is not None:
        bps_status = compare_field("bps", stored_bps, calc_bps)
    else:
        bps_status = "SKIP" if stored_bps is None else "PASS"
    results.append(
        {
            "period": period,
            "layer": "L2",
            "field": "bps",
            "status": bps_status,
            "db": stored_bps,
            "dart": calc_bps,
            "note": "equity/shares",
        }
    )

    stored_dr = num(row.get("debt_ratio"))
    calc_dr = recompute_debt_ratio(total_assets, total_equity)
    results.append(
        {
            "period": period,
            "layer": "L2",
            "field": "debt_ratio",
            "status": compare_field("debt_ratio", stored_dr, calc_dr),
            "db": stored_dr,
            "dart": calc_dr,
            "note": "(assets-equity)/equity",
        }
    )

    return results


def print_summary(all_results: list[dict]) -> None:
    by_status: dict[str, int] = {}
    for r in all_results:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    print("\n=== Summary ===")
    for k in ["PASS", "FAIL", "SKIP"]:
        if k in by_status:
            print(f"  {k}: {by_status[k]}")
    fails = [r for r in all_results if r["status"] == "FAIL"]
    if fails:
        print("\n=== FAIL details (first 30) ===")
        for r in fails[:30]:
            print(
                f"  {r.get('ticker','?')} {r['period']} {r['layer']} {r['field']}: "
                f"db={r.get('db')} ref={r.get('dart')} {r.get('note','')}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate DB financials vs DART (L1/L2)")
    parser.add_argument("--ticker", help="Single ticker")
    parser.add_argument("--tickers", help="Comma-separated tickers")
    parser.add_argument("--all-active", action="store_true", help="All active KR with dart_corp_code")
    parser.add_argument("--layer2-only", action="store_true", help="Skip L1 DART field compare")
    args = parser.parse_args()

    if args.all_active:
        tickers = None
    elif args.tickers:
        tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
    elif args.ticker:
        tickers = [args.ticker]
    else:
        tickers = PILOT_TICKERS
        print(f"[INFO] Default pilot tickers: {', '.join(tickers)}")

    turso_url, turso_token, dart_key = init_env()
    if not dart_key:
        print("[ERROR] DART_API_KEY required for Layer 1")
        sys.exit(1)

    http_url = turso_http_url(turso_url)
    stocks = load_stocks(http_url, turso_token, tickers, args.all_active)
    if not stocks:
        print("[ERROR] No matching stocks")
        sys.exit(1)

    all_results: list[dict] = []
    for stock in stocks:
        ticker = stock["ticker"]
        corp = stock["dart_corp_code"]
        stock_id = int(stock["id"])
        print(f"\n--- {ticker} ({stock.get('name','')}) corp={corp} ---")
        rows = load_financials(http_url, turso_token, stock_id)
        if not rows:
            print("  (no DART financials rows)")
            continue
        for row in rows:
            row_results = validate_row(dart_key, corp, row, args.layer2_only)
            for r in row_results:
                r["ticker"] = ticker
                status = r["status"]
                sym = "✓" if status == "PASS" else ("?" if status == "SKIP" else "✗")
                print(f"  {sym} {r['period']} {r['layer']} {r['field']}: {status}")
            all_results.extend(row_results)

    print_summary(all_results)
    fail_count = sum(1 for r in all_results if r["status"] == "FAIL")
    sys.exit(1 if fail_count else 0)


if __name__ == "__main__":
    main()
