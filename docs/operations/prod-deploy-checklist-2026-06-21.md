# GSF-Investor — 커밋·prod 배포 체크리스트

> **작성:** 2026-06-21 (Cursor 검증 세션)  
> **대상:** 6-Phase 로컬 변경 → main push → prod Turso migrate → 실사용 전환

---

## A. 커밋 메시지 초안

```
feat: 6-phase ops upgrade — AI fallback, batch queries, cron alerts

- Optimize discover all-scores from N+1 to 7 batch queries (db-utils)
- Add auto_financials.py + quarterly_financials.yml for KR quarterly data
- Enable Gemini Search Grounding; add ai-provider with Claude Sonnet fallback
- Add snapshot-history API and HoldingReturnChart on stock detail
- Add Telegram failure alerts to 5 GitHub Actions workflows
- Add vitest coverage for db-utils and gemini (25 tests)
- Update WEEKLY_STATUS, _handoff, and ops docs

Prod migrate (holding_snapshots) and first cron run remain a separate
manual step — see docs/operations/prod-deploy-checklist-2026-06-21.md §B.
```

### A.1 스테이징 범위

**포함 (권장):**

```bash
cd /Users/gsf/.gemini/antigravity/scratch/projects/GSF-Investor

git add \
  .github/workflows/daily_dart.yml \
  .github/workflows/daily_price.yml \
  .github/workflows/holding_snapshot.yml \
  .github/workflows/update_dividend_calendar.yml \
  .github/workflows/weekly_signal.yml \
  .github/workflows/quarterly_financials.yml \
  .gitignore \
  package.json \
  vitest.config.ts \
  scripts/auto_financials.py \
  scripts/ag_session_checkpoint.sh \
  scripts/archive_portfolio_repo.sh \
  scripts/smoke_net_worth_cron.sh \
  scripts/push_telegram_to_vercel.sh \
  scripts/setup_telegram_vercel.sh \
  scripts/telegram_chat_id_from_token.sh \
  scripts/trigger_dividend_workflow.sh \
  src/lib/ai-provider.ts \
  src/lib/db-utils.ts \
  src/lib/gemini.ts \
  src/lib/__tests__/db-utils.test.ts \
  src/lib/__tests__/gemini.test.ts \
  src/app/api/stocks/\[ticker\]/snapshot-history/ \
  src/app/api/cron/net-worth-snapshot/route.ts \
  src/app/api/dashboard/route.ts \
  src/app/api/discover/ \
  src/app/api/reports/ \
  src/app/api/stocks/ \
  src/app/stocks/\[ticker\]/StockDetailClient.tsx \
  src/components/StockCharts.tsx \
  docs/operations/ \
  WEEKLY_STATUS.md \
  _handoff.md \
  .telegram.env.example
```

**제외 (커밋 금지):**

| 경로 | 이유 |
|------|------|
| `.claude/` | 로컬 IDE 설정 |
| `.cursor/debug-*.log` | 디버그 로그 |
| `scripts/__pycache__/` | Python 캐시 |
| `.telegram.env` | 시크릿 (`.gitignore`에 추가됨) |

### A.2 커밋 전 검증 (필수)

```bash
npm run lint
npm run test      # 25 passed 기대
npm run build
```

### A.3 push 후

- [ ] Vercel production deploy 성공 확인
- [ ] GitHub Actions secrets 존재 확인: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- [ ] (선택) `quarterly_financials.yml` workflow_dispatch 1회 — KR 재무 적재 테스트

---

## B. prod Turso migrate 체크리스트

> **승인:** Joseph (REAL_DATA_RUN_ACK)  
> **선행:** §A 커밋·push 완료 + `ag:session:checkpoint`

### B.0 사전 확인

- [ ] Turso 콘솔에서 **복구/스냅샷** 수단 확인
- [ ] `.env.local`의 `TURSO_DATABASE_URL`이 **운영 gsf-investor** 인스턴스인지 사람이 확인
- [ ] `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`가 GitHub Secrets + Vercel env에 설정됨
- [ ] 로컬에서 `npm run build` / `npm run test` 통과 (§A.2)

### B.1 AG Safe Session checkpoint

```bash
cd /Users/gsf/.gemini/antigravity/scratch/projects/GSF-Investor
npm run ag:session:checkpoint
```

- [ ] git tag `checkpoint/ag-*` 생성됨
- [ ] `backups/ag-sessions/*.db` Turso export (실패 시 수동 export)
- [ ] manifest `.ag-session.json` checkpointed=true

### B.2 로컬 DB 사전 검증 (선택·권장)

```bash
# holding_snapshots 테이블 존재 확인
sqlite3 local.db ".tables" | grep holding_snapshots

# 없으면
npm run db:generate
npm run db:migrate

# 드라이런 (쓰기 없음)
DRY_RUN=1 python3 scripts/holding_snapshot.py
```

- [ ] `local.db`에 `holding_snapshots` 테이블 존재
- [ ] DRY_RUN 로그에 종가·환산값 오류 없음

### B.3 prod 스키마 migrate

```bash
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE npm run db:migrate
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE npm run db:views   # v_portfolio 재적용
```

- [ ] migrate exit 0
- [ ] Turso 콘솔 또는 CLI로 `holding_snapshots` 테이블 존재 확인

```bash
# Turso CLI 예시
turso db shell gsf-investor "SELECT name FROM sqlite_master WHERE type='table' AND name='holding_snapshots';"
```

### B.4 첫 holding_snapshot 적재

**방법 A — GitHub Actions (권장):**

1. GitHub → Actions → **Holding Snapshot** workflow
2. **Run workflow** (workflow_dispatch)
3. 로그에서 `✅ holding_snapshots 신규/갱신` 확인

**방법 B — 로컬 (운영 DB 직접):**

```bash
export REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE
# TURSO_* 는 .env.local 또는 export
python3 scripts/holding_snapshot.py
```

- [ ] `holding_snapshots`에 오늘 날짜 행 ≥ 1건
- [ ] `market_value_krw`, `unrealized_pnl_krw` NULL 아님 (보유 종목 있는 경우)

### B.5 prod UI 수동 검증

| # | 확인 항목 | URL / 방법 | 기대 |
|---|-----------|------------|------|
| 1 | 대시보드 로드 | `/` | KPI·NetWorthHistoryChart 표시 |
| 2 | 순자산 차트 | `/` Stacked Area | `net_worth_snapshots` 데이터 있으면 곡선 |
| 3 | 포트폴리오 수익률 | `/` PortfolioPerformanceChart | **2일+** 스냅샷 후 곡선 (1일만이면 empty state 정상) |
| 4 | 종목 상세 수익률 | `/stocks/[ticker]` | HoldingReturnChart (스냅샷 후) |
| 5 | Discover compare | `/discover?compare=TICK1,TICK2` | 비교 차트 |
| 6 | AI 보고서 생성 | `/reports` → Generate | Gemini streaming; 실패 시 Claude fallback |
| 7 | 배당 캘린더 | `/dividends` | 목록·필터 |
| 8 | Settings 통화 | `/settings` | base_currency 변경 → 대시보드 KPI 반영 |

- [ ] 위 8항목 중 실패 항목 없음 (또는 empty state가 데이터 부재로 정당한 경우 문서화)

### B.6 크론·알림 스모크

```bash
# 순자산 cron (Vercel)
bash scripts/smoke_net_worth_cron.sh

# (선택) 배당 workflow 트리거
bash scripts/trigger_dividend_workflow.sh
```

- [ ] `smoke_net_worth_cron.sh` exit 0
- [ ] (의도적 실패 테스트 시) Telegram 알림 수신 확인 — **prod에서 실패 유도 금지**, staging 또는 로컬만

### B.7 2일 후 후속 (포트폴리오 수익률 차트)

- [ ] holding_snapshot cron 2영업일 연속 실행 확인
- [ ] `/` PortfolioPerformanceChart에 수익률 라인 표시
- [ ] WEEKLY_STATUS.md §B.7 완료 체크

---

## C. 롤백

```bash
npm run ag:session:rollback   # manifest 기준
# 또는 Turso export 복원:
turso db restore gsf-investor backups/ag-sessions/<session_id>.db
```

---

## D. 완료 후

- [ ] `_handoff.md`에 prod migrate·첫 스냅샷 결과 append
- [ ] `WEEKLY_STATUS.md` P0 항목 체크
- [ ] `docs/specs/2026-05-21-investor-upgrade-design-v2.md` §3.3·§12 DoD 체크박스 갱신 (선택)

---

## E. 알려진 후속 (P1)

- REAL_DATA_RUN_ACK yml 하드코딩 → GitHub Secrets 이관
- 포트폴리오·Compare 차트 `formatMoney` 통화 확장
- `/journal` INIT 재입력 (사용자 데이터)
