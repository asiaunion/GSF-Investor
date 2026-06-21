# 세션 요약 — 2026-05-23 (GSF-Investor 운영·폐기 마무리)

> 다음 세션 시작 시: [remaining-work.md](./remaining-work.md) · 본 문서

## 완료한 일

### GitHub·로컬 정리

| 항목 | 결과 |
|------|------|
| Repo rename | `asiaunion/gsf-investor` → **`asiaunion/GSF-Investor`** |
| Cursor symlink | `/Users/gsf/dev/Cursor/GSF-Investor` → 정본 |
| `gsf-portfolio-web` | GitHub Archive → Delete |
| Vercel `gsf-portfolio-web` | 프로젝트 삭제 (`*.vercel.app` 404) |
| 로컬 `GSF-Portfolio` | 폴더 삭제 (백업 tar 권장) |

### Phase 2b·운영 (1~5)

| # | 작업 | 상태 |
|---|------|------|
| 1 | `/journal` INIT 재입력 | 완료 |
| 2 | `/` · `/wealth` 주식 평가 반영 | 완료 |
| 3 | 순자산 cron 스모크 | HTTP 200, prod 스냅샷 INSERT |
| 4 | Telegram 순자산 | **`gsf_investor`** 봇 — GitHub secrets 와 동일 token/chat id → Vercel Production |
| 5 | 배당 cron | Actions `Weekly Dividend Calendar Update #1` 성공 |

### 코드·스크립트 (이번 세션)

- `src/app/api/cron/net-worth-snapshot/route.ts` — `telegramConfigured`, `telegramSent` 응답
- `scripts/smoke_net_worth_cron.sh` — placeholder 차단, `jq` 로 Telegram 검증
- `scripts/setup_telegram_vercel.sh`, `push_telegram_to_vercel.sh`, `telegram_chat_id_from_token.sh`
- `scripts/trigger_dividend_workflow.sh`
- `docs/operations/github-repo-rename.md`, `telegram-net-worth-alert.md`
- `.telegram.env.example` (gitignore: `.telegram.env`)

### 보안 메모

- `CRON_SECRET` 채팅 노출 → **rotate 완료** (이후 값은 채팅·스크린에 올리지 않음)
- Vercel Sensitive 변수는 대시보드에서 재열람 불가 → rotate 시 새 값만 1회 보관

## 정본 URL·경로

| | |
|---|---|
| Production | https://gsf-investor.vercel.app |
| 정본 repo | `/Users/gsf/.gemini/antigravity/scratch/projects/GSF-Investor` |
| GitHub | `git@github.com:asiaunion/GSF-Investor.git` |

## 다음 세션 (선택 — Phase 3)

- [phase-2b-backlog.md](./phase-2b-backlog.md) 연기 항목
- Compare/수익률 차트 통화, 배당 UI, DART L1, cron 실패 알림 등
- **필수 운영 1~5는 모두 완료** — 당장 blocking 작업 없음

## 빠른 명령

```bash
# 순자산 cron 스모크 (CRON_SECRET은 로컬만)
BASE_URL=https://gsf-investor.vercel.app CRON_SECRET='...' ./scripts/smoke_net_worth_cron.sh

# 배당 workflow 수동
./scripts/trigger_dividend_workflow.sh   # gh auth 필요
```
