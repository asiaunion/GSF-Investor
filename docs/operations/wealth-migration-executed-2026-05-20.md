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

## 사용자 후속 (필수)

1. [ ] Vercel Production 배포 (최신 `gsf-investor` 코드)
2. [ ] Vercel env: `CRON_SECRET` 추가 (Portfolio에서 이전 가능)
3. [ ] `/wealth`에서 금액 검토·수정
4. [ ] (선택) `reset_trade_journal.py` 후 `/journal` 주식 재입력
5. [ ] cron 수동 테스트: `curl -H "Authorization: Bearer $CRON_SECRET" https://<investor-domain>/api/cron/net-worth-snapshot`
6. [ ] [portfolio-decommission.md](./portfolio-decommission.md) — Portfolio 앱 폐기

## trade_journal

이번 실행에서 **일지는 삭제하지 않음**. 재입력 전략을 쓰려면:

```bash
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/reset_trade_journal.py
```
