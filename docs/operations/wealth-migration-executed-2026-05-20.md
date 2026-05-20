# Portfolio 통합 실행 기록 (2026-05-20)

에이전트가 프로덕션 Turso에 적용한 작업입니다.

## 완료된 작업

| 단계 | 결과 |
|------|------|
| `npm run db:wealth-schema` | Production Turso — `wealth_positions`, `net_worth_snapshots` 생성 |
| `import_wealth_from_sheets.py --from-mock` | **22행** seed (Portfolio mock, 주식 제외) |
| `npm run build` | 성공 (`/wealth`, API 라우트 포함) |

## 시드 내용 (요약)

- 예수금 3건 (대신/키움/미래에셋)
- 주식담보대출 4건 → `stock_loans`
- 주택·기타·학자금·카드 대출 → `wealth_positions` (is_liability)
- 부동산 시세·보증금 6건

**주의:** 실제 Google 시트가 아닌 **Portfolio 앱 내장 mock** 기준입니다. 실제 시트와 맞추려면 `GSHEETS_CSV_URL` 또는 `GCP_*` 설정 후 import 재실행하거나 `/wealth`에서 수정하세요.

## 배포 (2026-05-20)

| 항목 | 결과 |
|------|------|
| Vercel Production | https://gsf-investor.vercel.app (`npx vercel deploy --prod`) |
| Git | `feat/portfolio-wealth-merge` → `10ff260` (main 직접 push 훅 차단 → PR 머지 필요) |
| `CRON_SECRET` | Vercel Production에 신규 생성·등록 후 재배포 완료 (값은 Vercel 대시보드 → Settings → Environment Variables) |
| Cron 스케줄 | `vercel.json` — 매일 15:00 UTC (`0 15 * * *`) |

## 사용자 후속

1. [x] Vercel Production 배포
2. [x] Vercel env: `CRON_SECRET`
3. [ ] GitHub PR 머지: https://github.com/asiaunion/gsf-investor/compare/main...feat/portfolio-wealth-merge
4. [ ] `/wealth`에서 금액 검토·수정 (로그인 후)
5. [ ] (선택) `reset_trade_journal.py` 후 `/journal` 주식 재입력
6. [ ] cron 수동 테스트: `curl -H "Authorization: Bearer $CRON_SECRET" https://gsf-investor.vercel.app/api/cron/net-worth-snapshot`
7. [ ] (선택) `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — 스냅샷 알림용 Vercel env
8. [ ] [portfolio-decommission.md](./portfolio-decommission.md) — Portfolio 앱 폐기

## trade_journal

이번 실행에서 **일지는 삭제하지 않음**. 재입력 전략을 쓰려면:

```bash
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/reset_trade_journal.py
```
