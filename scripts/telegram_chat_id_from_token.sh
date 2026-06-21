#!/usr/bin/env bash
# gsf_investor 봇 token 으로 getUpdates 에서 chat id 후보 출력 (SEC 알림 받는 대화방)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.telegram.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.telegram.env"
  set +a
fi

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  read -r -s -p "TELEGRAM_BOT_TOKEN (입력 내용은 화면에 안 보임): " TOKEN
  echo ""
fi

if [[ -z "$TOKEN" ]]; then
  echo "❌ token 없음"
  exit 1
fi

echo "→ getUpdates (최근 대화방 목록)"
curl -sS "https://api.telegram.org/bot${TOKEN}/getUpdates" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data.get('ok'):
    print('API 오류:', data)
    sys.exit(1)
seen = {}
for u in data.get('result', []):
    msg = u.get('message') or u.get('channel_post') or {}
    chat = msg.get('chat') or {}
    cid = chat.get('id')
    if cid is None or cid in seen:
        continue
    seen[cid] = chat
for cid, chat in seen.items():
    title = chat.get('title') or chat.get('first_name') or chat.get('username') or '?'
    print(f'  chat_id={cid}  type={chat.get(\"type\")}  name={title}')
if not seen:
    print('  (비어 있음 — 봇에게 /start 한 번 보낸 뒤 다시 실행)')
"
