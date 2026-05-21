#!/usr/bin/env python3
"""Read/write .ag-session.json for AG safe session tooling."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = ROOT / ".ag-session.json"


def manifest_path() -> Path:
    raw = os.environ.get("AG_SESSION_MANIFEST", "").strip()
    return Path(raw) if raw else DEFAULT_MANIFEST


def load() -> dict[str, Any]:
    path = manifest_path()
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save(data: dict[str, Any]) -> Path:
    path = manifest_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return path


def cmd_init(args: argparse.Namespace) -> int:
    ts = args.session_id
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "session_id": ts,
        "started_at": now,
        "updated_at": now,
        "checkpointed": False,
        "git": {
            "branch": args.branch,
            "checkpoint_tag": args.tag,
            "commit": args.commit,
        },
        "turso": {
            "database": args.turso_db,
            "export_path": args.turso_export,
            "checkpoint_iso": args.turso_iso,
        },
        "vercel": {
            "deployment_id": None,
            "deployment_url": None,
            "project": args.vercel_project,
        },
    }
    path = save(data)
    print(path)
    return 0


def cmd_update(args: argparse.Namespace) -> int:
    data = load()
    if not data:
        print("ERROR: no manifest; run ag_session_start.sh first", file=os.sys.stderr)
        return 1
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if args.checkpointed:
        data["checkpointed"] = True
    if args.tag:
        data.setdefault("git", {})["checkpoint_tag"] = args.tag
    if args.commit:
        data.setdefault("git", {})["commit"] = args.commit
    if args.turso_export:
        data.setdefault("turso", {})["export_path"] = args.turso_export
    if args.turso_iso:
        data.setdefault("turso", {})["checkpoint_iso"] = args.turso_iso
    if args.vercel_id:
        data.setdefault("vercel", {})["deployment_id"] = args.vercel_id
    if args.vercel_url:
        data.setdefault("vercel", {})["deployment_url"] = args.vercel_url
    save(data)
    return 0


def cmd_print(_: argparse.Namespace) -> int:
    print(json.dumps(load(), indent=2, ensure_ascii=False))
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    data = load()
    cur: Any = data
    for key in args.key.split("."):
        if not isinstance(cur, dict) or key not in cur:
            return 1
        cur = cur[key]
    if cur is None:
        return 1
    print(cur)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init")
    p_init.add_argument("--session-id", required=True)
    p_init.add_argument("--branch", required=True)
    p_init.add_argument("--tag", required=True)
    p_init.add_argument("--commit", required=True)
    p_init.add_argument("--turso-db", default="gsf-investor")
    p_init.add_argument("--turso-export", default="")
    p_init.add_argument("--turso-iso", required=True)
    p_init.add_argument("--vercel-project", default="gsf-investor")
    p_init.set_defaults(func=cmd_init)

    p_up = sub.add_parser("update")
    p_up.add_argument("--checkpointed", action="store_true")
    p_up.add_argument("--tag")
    p_up.add_argument("--commit")
    p_up.add_argument("--turso-export")
    p_up.add_argument("--turso-iso")
    p_up.add_argument("--vercel-id")
    p_up.add_argument("--vercel-url")
    p_up.set_defaults(func=cmd_update)

    p_print = sub.add_parser("print")
    p_print.set_defaults(func=cmd_print)

    p_get = sub.add_parser("get")
    p_get.add_argument("--key", required=True)
    p_get.set_defaults(func=cmd_get)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
