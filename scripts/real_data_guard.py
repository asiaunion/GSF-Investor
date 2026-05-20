"""
Shared guard rails for scripts that WRITE to Turso (remote).

- Remote DB URLs (non file:…) require REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE unless DRY_RUN=1.
- In GitHub Actions, the same acknowledgement must be passed explicitly via env so scheduled
  runs remain intentional after this guard lands.
- DRY_RUN=1: callers should skip mutating batches (INSERT/REPLACE/…) while allowing reads.

Local file URLs (file:…) never require acknowledgement.
"""

from __future__ import annotations

import os
import sys

ACK_VALUE = "I_ACK_PROD_WRITE"


def getenv_bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def is_dry_run() -> bool:
    return getenv_bool("DRY_RUN", False)


def is_remote_database_url(url: str) -> bool:
    if not url or not str(url).strip():
        return False
    u = str(url).strip().lower()
    # Local libSQL file DB — no acknowledgement
    if u.startswith("file:"):
        return False
    # Everything else (libsql://, https pipeline endpoints, etc.) treated as remote
    return True


def enforce_remote_write_guard(*, database_url: str, script_name: str) -> None:
    """
    Call at the start of main() AFTER env/url checks.
    Allows writes when URL is local file:, or DRY_RUN=1 (no writes intended), or acknowledgement set.
    """
    url = database_url.strip() if isinstance(database_url, str) else ""
    if not is_remote_database_url(url):
        return

    if is_dry_run():
        print(
            f"[{script_name}] DRY_RUN=1 — remote URL but mutating statements should be skipped by the script."
        )
        return

    ack = os.environ.get("REAL_DATA_RUN_ACK", "").strip()
    if ack == ACK_VALUE:
        return

    in_actions = os.environ.get("GITHUB_ACTIONS", "").lower() == "true"
    if in_actions:
        print(
            f"[ERROR] {script_name}: GitHub Actions detected with a remote Turso URL. "
            f"Set env REAL_DATA_RUN_ACK={ACK_VALUE} on the workflow step."
        )
    else:
        print(
            f"[ERROR] {script_name}: remote database URL detected.\n"
            f"  To allow writes from your machine: export REAL_DATA_RUN_ACK={ACK_VALUE}\n"
            "  Or run with DRY_RUN=1 to exercise fetch/analysis without committing writes "
            "(scripts must honour DRY_RUN in their batch helpers).\n"
            "  Local file: URLs do not require this acknowledgement."
        )
    sys.exit(2)


def log_dry_run_skipped_writes(*, stmt_count: int, sample_sql: str | None = None) -> None:
    print(f"  [DRY_RUN] Skipping {stmt_count} write statement(s).")
    if sample_sql:
        preview = sample_sql.replace("\n", " ").strip()
        if len(preview) > 120:
            preview = preview[:117] + "..."
        print(f"  [DRY_RUN] Example SQL: {preview}")
