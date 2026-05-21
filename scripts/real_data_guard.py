"""
Shared guard rails for scripts that WRITE to Turso (remote).

- Remote DB URLs (non file:…) require REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE unless DRY_RUN=1.
- In GitHub Actions, the same acknowledgement must be passed explicitly via env so scheduled
  runs remain intentional after this guard lands.
- DRY_RUN=1: callers should skip mutating batches (INSERT/REPLACE/…) while allowing reads.

Local file URLs (file:…) never require acknowledgement.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ACK_VALUE = "I_ACK_PROD_WRITE"
DEFAULT_MANIFEST = Path(__file__).resolve().parent.parent / ".ag-session.json"


def getenv_bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def is_dry_run() -> bool:
    return getenv_bool("DRY_RUN", False)


def _manifest_path() -> Path:
    raw = os.environ.get("AG_SESSION_MANIFEST", "").strip()
    return Path(raw) if raw else DEFAULT_MANIFEST


def enforce_ag_session_checkpoint(*, script_name: str) -> None:
    """
    When .ag-session.json exists, require checkpointed=true before remote writes.
    Skip if AG_SESSION_SKIP_CHECKPOINT=1 (emergency) or no manifest (CI/cron use their own ACK).
    """
    if getenv_bool("AG_SESSION_SKIP_CHECKPOINT", False):
        return
    path = _manifest_path()
    if not path.exists():
        return
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        print(
            f"[WARN] {script_name}: could not read {path}; "
            "run npm run ag:session:checkpoint before prod writes."
        )
        return
    if data.get("checkpointed") is True:
        return
    print(
        f"[ERROR] {script_name}: AG session manifest exists but checkpointed is not true.\n"
        "  Run: npm run ag:session:checkpoint\n"
        "  (Immediately before production Turso writes.)\n"
        "  Emergency override: AG_SESSION_SKIP_CHECKPOINT=1"
    )
    sys.exit(2)


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

    enforce_ag_session_checkpoint(script_name=script_name)

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
