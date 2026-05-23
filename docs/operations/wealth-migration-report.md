# GSF-Portfolio → Investor 자산 이관

## 정책

| 데이터 | 처리 |
|--------|------|
| 시트 `주식` 행 | **이관 안 함** — `/journal`에서 재입력 |
| `trade_journal` 기존 | **폐기 가능** — `scripts/reset_trade_journal.py` |
| `예수금` | **증권사별 1행** → `wealth_positions` |
| 부동산·각종 대출 | `wealth_positions` (부채는 `is_liability=1`) |
| `주식담보대출` | `stock_loans` (label에 증권사) |
| 이관 후 수치 | **UI/API에서 자유 수정** — DB가 정본 (시트/Yahoo 덮어쓰기 없음) |

## Phase 0 — 인벤토리

| 항목 | Investor | Portfolio (폐기 예정) |
|------|----------|------------------------|
| Repo | `asiaunion/GSF-Investor` | `asiaunion/gsf-portfolio-web` |
| DB | Turso `TURSO_DATABASE_URL` | 동일 URL 가능 — `portfolio_snapshots` 레거시 |
| 인증 | NextAuth Google | PIN + `APP_SESSION_TOKEN` |
| 순자산 UI | `/wealth` | `/` |
| 주식 포지션 | `trade_journal` → `v_portfolio` | 시트 `주식` 행 |
| Cron | `/api/cron/net-worth-snapshot` | `/api/cron/snapshot` |

시트 CSV 백업 후 `주식` 행은 참고용만 보관.

## 실행 순서

```bash
# 1. 스키마 (v_portfolio 때문에 db:push 실패 시)
npm run db:wealth-schema
# 프로덕션:
# REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE npm run db:wealth-schema

# 2. (선택) 매매 일지 비우기 — 주식 재입력 전
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/reset_trade_journal.py

# 3. 시트 seed
python3 scripts/import_wealth_from_sheets.py --from-mock   # 로컬
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/import_wealth_from_sheets.py  # 프로덕션
```

## 주식 포지션 재입력 체크리스트

1. [ ] `/settings`에서 관심 종목·`yahoo_ticker` 확인
2. [ ] `/journal` → 종목별 **INIT** (증권사·수량·평균단가·통화)
3. [ ] `/` 대시보드에 보유·평가·수익률 표시 확인
4. [ ] `/wealth` 순자산에 **주식 평가** 합산 반영 확인
5. [ ] `scripts/daily_price.py` 또는 크론으로 주가 갱신

## 검증 (컷오버)

**1단계 (이관 직후)**  
- `/wealth` 비주식+부채 ≈ Portfolio 홈에서 주식 제외 합계 (±1%)

**2단계 (일지 재입력 후)**  
- 전체 순자산·대시보드 주식 평가 일치

**API**  
- `GET /api/wealth/summary`
- `GET /api/cron/net-worth-snapshot` + `Authorization: Bearer $CRON_SECRET`

## 구현 파일

| 용도 | 경로 |
|------|------|
| 스키마 | `src/db/schema.ts` (`wealth_positions`, `net_worth_snapshots`) |
| 집계 | `src/lib/net-worth.ts` |
| UI | `src/app/wealth/*` |
| API | `src/app/api/wealth/*`, `src/app/api/cron/net-worth-snapshot` |
| Import | `scripts/import_wealth_from_sheets.py` |
| 일지 reset | `scripts/reset_trade_journal.py` |

## GSF-Portfolio 폐기

[portfolio-decommission.md](./portfolio-decommission.md)

## 실행 기록

- [wealth-migration-executed-2026-05-20.md](./wealth-migration-executed-2026-05-20.md) — 프로덕션 스키마·mock seed (2026-05-20)
