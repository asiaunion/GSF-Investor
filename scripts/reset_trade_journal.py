#!/usr/bin/env python3
"""
trade_journal 전체 삭제 (주식 포지션 재입력 전).
v_portfolio는 trade_journal 기준이므로 비우면 주식 평가=0.

Usage:
  REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/reset_trade_journal.py
  python3 scripts/reset_trade_journal.py --dry-run
"""

import os
import sys

_script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _script_dir)

from financial_validation_lib import init_env, turso_http_url, turso_query
from real_data_guard import enforce_remote_write_guard, is_dry_run


def main() -> None:
    turso_url, turso_token, _ = init_env()
    enforce_remote_write_guard(database_url=turso_url, script_name="reset_trade_journal.py")

    if is_dry_run() or "--dry-run" in sys.argv:
        count = turso_query(
            turso_http_url(turso_url),
            turso_token,
            "SELECT COUNT(*) AS c FROM trade_journal",
        )
        n = count[0]["c"] if count else 0
        print(f"[dry-run] Would DELETE {n} trade_journal rows")
        return

    turso_query(turso_http_url(turso_url), turso_token, "DELETE FROM trade_journal")
    print("✅ trade_journal cleared — re-enter positions at /journal")


if __name__ == "__main__":
    main()
