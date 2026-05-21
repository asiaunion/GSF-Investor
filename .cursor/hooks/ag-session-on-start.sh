#!/usr/bin/env bash
# sessionStart: ensure AG safe session exists; inject context for the agent.
set -euo pipefail

ROOT="$(pwd)"
cd "$ROOT"

python3 <<'PY'
import json
import os
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
manifest = root / ".ag-session.json"
lines: list[str] = []

def run(cmd: list[str]) -> str:
    r = subprocess.run(cmd, cwd=root, capture_output=True, text=True)
    out = (r.stdout or "") + (r.stderr or "")
    return out.strip()[-2000:] if len(out) > 2000 else out.strip()

if not manifest.exists():
    lines.append("No .ag-session.json — running `npm run ag:session:start -- cursor-auto`.")
    log = run(["npm", "run", "ag:session:start", "--", "cursor-auto"])
    if log:
        lines.append(log)
else:
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    sid = data.get("session_id", "?")
    branch = data.get("git", {}).get("branch", "?")
    tag = data.get("git", {}).get("checkpoint_tag", "?")
    ck = data.get("checkpointed", False)
    lines.append(f"AG safe session active: session_id={sid}, branch={branch}, checkpoint_tag={tag}, checkpointed={ck}.")

try:
    cur_branch = subprocess.check_output(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=root, text=True
    ).strip()
except subprocess.CalledProcessError:
    cur_branch = "?"

lines.append(f"Current git branch: {cur_branch}.")
lines.append("Read docs/operations/ag-safe-session-for-ag.md for the full flow.")
lines.append("Before prod Turso writes or `vercel deploy --prod`, checkpoint runs automatically via shell hook.")

ctx = "\n".join(lines)
print(json.dumps({"additional_context": ctx}, ensure_ascii=False))
PY
