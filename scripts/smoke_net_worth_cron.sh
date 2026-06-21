#!/usr/bin/env bash
# 순자산 스냅샷 cron 스모크 (로컬 dev 또는 Production)
# Usage:
#   ./scripts/smoke_net_worth_cron.sh
#   BASE_URL=https://gsf-investor.vercel.app CRON_SECRET=xxx ./scripts/smoke_net_worth_cron.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for envfile in .env.local .env.vercel.tmp; do
  if [[ -f "$envfile" && -z "${CRON_SECRET:-}" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$envfile" 2>/dev/null || true
    set +a
  fi
done

BASE_URL="${BASE_URL:-http://localhost:3000}"
SECRET="${CRON_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "❌ CRON_SECRET 없음 — .env.local 또는 환경변수에 설정하세요."
  exit 1
fi

if [[ "$SECRET" == *"붙여넣기"* || "$SECRET" == "your-secret" ]]; then
  echo "❌ CRON_SECRET이 예시 문구입니다. Vercel → gsf-investor → Settings → Environment Variables → Production CRON_SECRET 값을 복사하세요."
  exit 1
fi

URL="${BASE_URL%/}/api/cron/net-worth-snapshot"
echo "→ GET $URL"

HTTP=$(curl -sS -o /tmp/gsf-nw-cron.json -w "%{http_code}" \
  -H "Authorization: Bearer ${SECRET}" \
  "$URL")

echo "HTTP $HTTP"
cat /tmp/gsf-nw-cron.json
echo ""

if [[ "$HTTP" != "200" ]]; then
  exit 1
fi

echo "✅ 순자산 스냅샷 cron 스모크 통과"

if command -v jq >/dev/null 2>&1; then
  configured=$(jq -r '.telegramConfigured // false' /tmp/gsf-nw-cron.json)
  sent=$(jq -r '.telegramSent // false' /tmp/gsf-nw-cron.json)
  if [[ "$configured" == "true" && "$sent" == "true" ]]; then
    echo "✅ Telegram 전송 OK (telegramSent: true) — 앱에서 메시지도 확인하세요."
  elif [[ "$configured" == "true" ]]; then
    echo "❌ Production에 TELEGRAM_*는 있으나 telegramSent:false — token/chat id·Redeploy 확인"
    exit 1
  else
    echo "ℹ️  Production TELEGRAM_* 미설정 — DB 스냅샷만 확인됨"
    echo "    설정: ./scripts/setup_telegram_vercel.sh"
  fi
elif [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "ℹ️  로컬 TELEGRAM_* 설정됨 — Production 응답의 telegramSent는 jq로 확인 권장"
else
  echo "ℹ️  TELEGRAM_* 미설정 — ./scripts/setup_telegram_vercel.sh"
fi
