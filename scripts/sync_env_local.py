#!/usr/bin/env python3
"""
Sync local .env.local from available sources.

- TURSO_*: Turso CLI (gsf-investor DB URL + fresh token)
- Other keys: Vercel API (production) when values exist

Vercel "sensitive" variables are often stored with an empty value if added via
CLI without stdin; env pull then writes KEY="". Re-enter those in the Vercel
dashboard, then re-run this script.

Usage:
  python3 scripts/sync_env_local.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
PROJECT_ID = "prj_PVd7vTQyeznOhIrNtSJNXf1HdMBG"
TEAM_ID = "team_sTBxRDzHmO7rXf44im715qyn"
VERCEL_KEYS = [
    "ALLOWED_EMAIL",
    "AUTH_SECRET",
    "AUTH_URL",
    "DART_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "TURSO_AUTH_TOKEN",
    "TURSO_DATABASE_URL",
]


def turso_value(args: list[str]) -> str:
    out = subprocess.check_output(["turso", *args], text=True, cwd=ROOT)
    return out.strip().splitlines()[-1].strip()


def vercel_token() -> str | None:
    auth = Path.home() / "Library/Application Support/com.vercel.cli/auth.json"
    if not auth.exists():
        return None
    with auth.open(encoding="utf-8") as f:
        return json.load(f).get("token")


def fetch_vercel_env() -> dict[str, str]:
    token = vercel_token()
    if not token:
        return {}
    url = (
        f"https://api.vercel.com/v9/projects/{PROJECT_ID}/env"
        f"?decrypt=true&teamId={TEAM_ID}"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read())
    envs = payload.get("envs", payload if isinstance(payload, list) else [])
    result: dict[str, str] = {}
    for item in envs:
        key = item.get("key")
        val = item.get("value") or ""
        if key and val:
            result[key] = val
    return result


def read_env_lines() -> list[str]:
    if not ENV_PATH.exists():
        return ["# Created by sync_env_local.py\n"]
    return ENV_PATH.read_text(encoding="utf-8").splitlines(keepends=True)


def set_key_in_lines(lines: list[str], key: str, value: str) -> list[str]:
    pattern = re.compile(rf"^{re.escape(key)}=")
    new_line = f'{key}="{value}"\n'
    replaced = False
    out: list[str] = []
    for line in lines:
        if pattern.match(line.rstrip("\n")):
            out.append(new_line)
            replaced = True
        else:
            out.append(line if line.endswith("\n") else line + "\n")
    if not replaced:
        out.append(new_line)
    return out


def main() -> int:
    updates: dict[str, str] = {}

    try:
        updates["TURSO_DATABASE_URL"] = turso_value(["db", "show", "gsf-investor", "--url"])
        updates["TURSO_AUTH_TOKEN"] = turso_value(["db", "tokens", "create", "gsf-investor"])
        print("✅ Turso CLI → TURSO_DATABASE_URL, TURSO_AUTH_TOKEN")
    except Exception as e:
        print(f"❌ Turso CLI failed: {e}", file=sys.stderr)
        return 1

    vercel = fetch_vercel_env()
    for key in VERCEL_KEYS:
        if key in ("TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"):
            continue
        if key in vercel and vercel[key]:
            updates[key] = vercel[key]
            print(f"✅ Vercel API → {key} (len={len(vercel[key])})")

    empty_on_vercel = [k for k in VERCEL_KEYS if k not in updates and k not in ("TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN")]
    if empty_on_vercel:
        print("\n⚠️  Vercel에 변수 이름만 있고 값이 비어 있음 (재입력 필요):")
        for k in empty_on_vercel:
            print(f"   - {k}")

    lines = read_env_lines()
    header = "# Synced by scripts/sync_env_local.py — Turso via CLI; others via Vercel API when set\n"
    if not lines[0].startswith("# Synced by"):
        lines.insert(0, header)

    for key, value in updates.items():
        lines = set_key_in_lines(lines, key, value)

    ENV_PATH.write_text("".join(lines), encoding="utf-8")
    print(f"\n✅ Wrote {ENV_PATH}")
    return 0 if not empty_on_vercel else 0


if __name__ == "__main__":
    raise SystemExit(main())
