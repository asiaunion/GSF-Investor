#!/usr/bin/env bash
# beforeShellExecution: auto-checkpoint before prod DB/deploy; block if no session.
set -euo pipefail

input="$(cat)"
export AG_HOOK_INPUT="$input"

python3 <<'PY'
import json
import os
import re
import subprocess
import sys
from pathlib import Path

payload = json.loads(os.environ.get("AG_HOOK_INPUT", "{}"))
command = payload.get("command") or ""

root = Path.cwd()
manifest_path = root / ".ag-session.json"

danger_patterns = [
    r"REAL_DATA_RUN_ACK\s*=\s*I_ACK_PROD_WRITE",
    r"vercel\s+deploy\b.*--prod",
    r"seed_financials_only\.py",
    r"seed_portfolio\.py",
    r"update_dividends\.py",
    r"import_wealth_from_sheets\.py",
    r"reset_trade_journal\.py",
    r"turso\s+db\s+import\b",
]
if not any(re.search(p, command) for p in danger_patterns):
    print(json.dumps({"permission": "allow"}))
    raise SystemExit(0)

def deny(user: str, agent: str) -> None:
    print(json.dumps({
        "permission": "deny",
        "user_message": user,
        "agent_message": agent,
    }, ensure_ascii=False))
    raise SystemExit(2)

if os.environ.get("AG_SESSION_SKIP_HOOKS", "").strip() in ("1", "true", "yes"):
    print(json.dumps({"permission": "allow"}))
    raise SystemExit(0)

if not manifest_path.exists():
    deny(
        "AG safe session이 없습니다. 에이전트가 `npm run ag:session:start`를 먼저 실행해야 합니다.",
        "Run `npm run ag:session:start` before production Turso writes or deploy --prod.",
    )

try:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    deny("`.ag-session.json`을 읽을 수 없습니다.", "Fix or recreate AG session with ag:session:start.")
    raise SystemExit(2)

if data.get("checkpointed") is True:
    print(json.dumps({"permission": "allow"}))
    raise SystemExit(0)

# Auto-checkpoint then allow
subprocess.run(
    ["npm", "run", "ag:session:checkpoint"],
    cwd=root,
    check=False,
)
try:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    data = {}

if data.get("checkpointed") is True:
    print(json.dumps({
        "permission": "allow",
        "agent_message": "Ran `npm run ag:session:checkpoint` automatically before this production command.",
    }, ensure_ascii=False))
    raise SystemExit(0)

deny(
    "체크포인트 자동 갱신에 실패했습니다. `npm run ag:session:checkpoint`를 수동 실행한 뒤 다시 시도하세요.",
    "Checkpoint failed. Run `npm run ag:session:checkpoint` manually.",
)
PY
