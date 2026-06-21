# 순자산 스냅샷 Telegram 알림

**봇:** 기존 **`gsf_investor`** (SEC/DART/시그널과 동일)  
**변수명:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — GitHub Actions secrets와 **같은 값**을 Vercel Production에도 넣습니다.

| 용도 | 위치 |
|------|------|
| SEC·DART·주간 시그널 | GitHub → `asiaunion/GSF-Investor` → Settings → Secrets → Actions |
| 순자산 스냅샷 cron | Vercel → `gsf-investor` → Environment Variables → **Production** |

새 봇을 만들 필요 없습니다. 스크린샷에 보이는 `🇺🇸 SEC 공시 수신` 메시지와 **동일한 token·chat id**입니다.

## 1. 값 확인 (이미 알림이 오고 있으면)

GitHub Actions secrets에 이미 있다면 그 값을 그대로 씁니다.

- https://github.com/asiaunion/GSF-Investor/settings/secrets/actions  
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (값은 GitHub에서 다시 열 수 없으면 BotFather token 재확인)

chat id를 잊었을 때만:

```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

→ `gsf_investor` 봇과의 대화방 `chat.id` (보통 본인 DM은 양수, 그룹은 음수)

## 2. Vercel Production에 추가

**CLI (값은 `.telegram.env`에만 두고 채팅에 붙이지 않음):**

```bash
cd /Users/gsf/.gemini/antigravity/scratch/projects/GSF-Investor
cp .telegram.env.example .telegram.env
# .telegram.env 편집 — GitHub Actions secrets 와 동일한 token·chat id

# chat id 모를 때 (token 만 알 때):
./scripts/telegram_chat_id_from_token.sh

./scripts/push_telegram_to_vercel.sh
```

대화형: `./scripts/setup_telegram_vercel.sh`

또는 Dashboard에서 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 추가 후 **Redeploy**.

## 3. 검증

```bash
BASE_URL=https://gsf-investor.vercel.app CRON_SECRET='(Production)' ./scripts/smoke_net_worth_cron.sh
```

- HTTP 200, `"telegramSent": true`
- Telegram **`gsf_investor`** 채팅에 `📊 [GSF 순자산 스냅샷]` (SEC 메시지와 같은 대화방)

## 문제 해결

| 증상 | 조치 |
|------|------|
| SEC는 오는데 순자산만 안 옴 | Vercel에 `TELEGRAM_*` 없음 → §2 |
| `telegramSent: false` | GitHub·Vercel token/chat id 불일치 |
| 새 봇 만들지 말 것 | Actions secrets와 Vercel 값이 같아야 함 |
