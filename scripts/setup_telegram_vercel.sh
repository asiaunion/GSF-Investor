#!/usr/bin/env bash
# Vercel Production에 TELEGRAM_* 추가 + (선택) redeploy
# Usage: ./scripts/setup_telegram_vercel.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v npx >/dev/null 2>&1; then
  echo "❌ npx 필요"
  exit 1
fi

echo "=== GSF-Investor Telegram (Production) ==="
echo ""
echo "기존 봇 gsf_investor 사용 — GitHub Actions secrets와 동일한 값을 입력하세요."
echo "  https://github.com/asiaunion/GSF-Investor/settings/secrets/actions"
echo "  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID"
echo ""
echo "(chat id만 모를 때) https://api.telegram.org/bot<TOKEN>/getUpdates"
echo ""

read -r -p "TELEGRAM_BOT_TOKEN: " BOT_TOKEN
read -r -p "TELEGRAM_CHAT_ID: " CHAT_ID

if [[ -z "$BOT_TOKEN" || -z "$CHAT_ID" ]]; then
  echo "❌ token/chat id 비어 있음"
  exit 1
fi

add_or_update() {
  local name=$1
  local value=$2
  if npx vercel env ls production 2>/dev/null | grep -q " ${name} "; then
    echo "→ $name 이미 있음 — 덮어쓰기"
    printf '%s' "$value" | npx vercel env rm "$name" production --yes 2>/dev/null || true
  fi
  printf '%s' "$value" | npx vercel env add "$name" production --yes --sensitive
}

add_or_update TELEGRAM_BOT_TOKEN "$BOT_TOKEN"
add_or_update TELEGRAM_CHAT_ID "$CHAT_ID"

echo ""
read -r -p "Production redeploy 지금 할까요? [y/N] " redeploy
if [[ "${redeploy,,}" == "y" ]]; then
  npx vercel deploy --prod --yes
  echo "✅ 배포 요청됨 — READY 후 스모크 실행"
else
  echo "ℹ️  Vercel Dashboard → Deployments → Redeploy 후 스모크하세요."
fi

echo ""
echo "검증 (CRON_SECRET은 채팅에 붙이지 말 것):"
echo "  BASE_URL=https://gsf-investor.vercel.app CRON_SECRET='...' ./scripts/smoke_net_worth_cron.sh"
echo "  → JSON에 telegramSent:true + Telegram 앱 메시지 확인"
