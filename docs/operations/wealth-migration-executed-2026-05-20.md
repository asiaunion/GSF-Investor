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
| Git | `main` @ `a74fa71` 머지 완료 (`feat/portfolio-wealth-merge` → origin/main) |
| `CRON_SECRET` | Vercel Production에 신규 생성·등록 후 재배포 완료 (값은 Vercel 대시보드 → Settings → Environment Variables) |
| Cron 스케줄 | `vercel.json` — 매일 15:00 UTC (`0 15 * * *`) |
| Cron 스모크 | `GET /api/cron/net-worth-snapshot` + Bearer → **200**, 첫 `net_worth_snapshots` 행 기록 |
| Middleware | `/api/cron` 공개 경로 추가 (Vercel Cron이 `/login`으로 리다이렉트되지 않도록) |

## 사용자 후속

1. [x] Vercel Production 배포
2. [x] Vercel env: `CRON_SECRET`
3. [x] `main` 머지 (`a74fa71`)
4. [ ] `/wealth`에서 금액 검토·수정 (로그인 후)
5. [ ] (선택) `reset_trade_journal.py` 후 `/journal` 주식 재입력
6. [x] cron 수동 테스트 (2026-05-20 스모크 200 OK)
7. [x] `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Vercel Production (순자산 스냅샷, 2026-05-23)
8. [x] Portfolio redirect 배포 + `APP_PIN` 제거 + 로컬 백업 (`~/backup-gsf-portfolio-20260520.tar.gz`); GitHub Archive만 수동
9. [x] AG 2026-05-21 주식상세 폭주 → `main` UI 원복, stash `ag-session-20260521-backup` ([ag-postmortem-2026-05-21.md](./ag-postmortem-2026-05-21.md))
10. [x] 주식상세 **재무 탭 차트 확정** (2026-05-21) — 아래 「재무 차트 (Editorial 확정)」 참고
11. [x] **AG 안전 세션** — `npm run ag:session:*`, full-stack rollback ([ag-safe-session.md](./ag-safe-session.md))

## 재무 차트 (Editorial 확정)

| 항목 | 내용 |
|------|------|
| UI | 손익·건전성 2차트 → **「재무 추이 (연간)」** 단일 통합 차트 |
| 막대 | 순이익·영업이익 **동일 폭 겹침** + 영업현금흐름 **나란한 막대**(동일 폭) |
| 선 | 매출 실선(우측 금액 축), 부채비율 **점선**(우측 % 축) |
| 시안 | Editorial / Slate / Ink **탭 제거** — `CHART_PALETTE` 고정 |
| 로컬 dev | `npm run dev` 시 `AUTH_URL=http://localhost:3000` (`package.json`) |
| Git | `6b8ec33` 통합 차트 · `0ce3b6b` 시안 제거 |
| Production | https://gsf-investor.vercel.app (Vercel deploy READY) |
| 확인 | `/stocks/{ticker}` → 재무 탭 (예: `/stocks/026960`) |

## trade_journal

이번 실행에서 **일지는 삭제하지 않음**. 재입력 전략을 쓰려면:

```bash
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/reset_trade_journal.py
```
