#!/usr/bin/env bash
# GitHub Actions 와 동일한 TELEGRAM_* 를 Vercel Production 에 등록 (값은 채팅/로그에 출력하지 않음)
#
# 방법 A — 파일 (권장, 1회):
#   cp .telegram.env.example .telegram.env
#   # .telegram.env 에 token·chat id 입력 (GitHub secrets 와 동일)
#   ./scripts/push_telegram_to_vercel.sh
#
# 방법 B — 환경변수:
#   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... ./scripts/push_telegram_to_vercel.sh
#
# 방법 C — 대화형:
#   ./scripts/setup_telegram_vercel.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${TELEGRAM_ENV_FILE:-$ROOT/.telegram.env}"

load_vars() {
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    return 0
  fi
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

load_vars

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "❌ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 없음"
  echo ""
  echo "  1) cp .telegram.env.example .telegram.env"
  echo "  2) .telegram.env 에 gsf_investor 봇 token·chat id 입력 (GitHub Actions secrets 와 동일)"
  echo "  3) ./scripts/push_telegram_to_vercel.sh"
  echo ""
  echo "  chat id 모를 때: ./scripts/telegram_chat_id_from_token.sh"
  exit 1
fi

add_or_update() {
  local name=$1
  local value=$2
  if npx vercel env ls production 2>/dev/null | grep -qw "$name"; then
    echo "→ $name 갱신"
    npx vercel env rm "$name" production --yes 2>/dev/null || true
  else
    echo "→ $name 추가"
  fi
  printf '%s' "$value" | npx vercel env add "$name" production --yes --sensitive
}

add_or_update TELEGRAM_BOT_TOKEN "$TELEGRAM_BOT_TOKEN"
add_or_update TELEGRAM_CHAT_ID "$TELEGRAM_CHAT_ID"

echo "✅ Vercel Production TELEGRAM_* 등록 완료"
echo "→ Redeploy 필요: npx vercel deploy --prod --yes"
redeploy="${AUTO_REDEPLOY:-}"
if [[ -z "$redeploy" ]]; then
  read -r -p "지금 Production redeploy 할까요? [y/N] " redeploy
fi
if [[ "${redeploy,,}" == "y" ]]; then
  npx vercel deploy --prod --yes
  echo "✅ 배포 완료 후: BASE_URL=https://gsf-investor.vercel.app CRON_SECRET='...' ./scripts/smoke_net_worth_cron.sh"
fi
