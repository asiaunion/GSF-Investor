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

- [x] Vercel production deploy 성공 확인 (2990a52 push → 자동 배포)
- [ ] GitHub Actions secrets 존재 확인: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (gh PAT 403 — Vercel/GitHub UI에서 확인)
- [ ] (선택) `quarterly_financials.yml` workflow_dispatch 1회 — KR 재무 적재 테스트
- [x] CI lockfile sync + workflow YAML 수정 (2026-06-21 follow-up)

---

## B. prod Turso migrate 체크리스트

> **승인:** Joseph (REAL_DATA_RUN_ACK)  
> **선행:** §A 커밋·push 완료 + `ag:session:checkpoint`

### B.0 사전 확인

- [ ] Turso 콘솔에서 **복구/스냅샷** 수단 확인
- [x] `.env.local`의 `TURSO_DATABASE_URL` = `libsql://gsf-investor-asiaunion.aws-ap-northeast-1.turso.io` (2026-06-21 확인)
- [ ] `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`가 GitHub Secrets + Vercel env에 설정됨
- [x] 로컬에서 `npm run build` / `npm run test` 통과 (§A.2)

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
- [x] DRY_RUN 로그에 종가·환산값 오류 없음 (prod URL, 4종목, 2026-06-21)

### B.3 prod 스키마 migrate

```bash
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE npm run db:migrate
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE npm run db:views   # v_portfolio 재적용
```

- [x] migrate exit 0 — **prod `holding_snapshots` 테이블 이미 존재** (2026-06-21 확인)
- [x] Turso prod: 86 rows, 최근 `2026-06-21` 4건

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

- [x] `holding_snapshots`에 오늘 날짜 행 ≥ 1건 (2026-06-21, 4 rows)
- [x] `market_value_krw`, `unrealized_pnl_krw` 값 존재 (보유 4종목)

### B.5 prod UI 수동 검증

| # | 확인 항목 | URL / 방법 | 기대 | prod 검증 |
|---|-----------|------------|------|-----------|
| 1 | 대시보드 로드 | `/` | KPI·NetWorthHistoryChart 표시 | ✅ 2026-06-21 — KPI·보유 4종목·시그널·대출 |
| 2 | 순자산 차트 | `/` Stacked Area | `net_worth_snapshots` 데이터 있으면 곡선 | ✅ 순자산 추이 Area 표시 |
| 3 | 포트폴리오 수익률 | `/` PortfolioPerformanceChart | **2일+** 스냅샷 후 곡선 | ✅ 수익률 라인 + 벤치마크(069500) 오버레이 |
| 4 | 종목 상세 수익률 | `/stocks/[ticker]` | HoldingReturnChart (스냅샷 후) | ✅ `/stocks/026960` 보유 수익률 추이 |
| 5 | Discover compare | `/discover?compare=TICK1,TICK2` | 비교 차트 | ✅ 026960 vs 069500 정규화 % + 지표 테이블 |
| 6 | AI 보고서 생성 | `/reports` → Generate | Gemini streaming; 실패 시 Claude fallback | ✅ 동서(026960), Gemini 2.5 Flash, 저장 완료 |
| 7 | 배당 캘린더 | `/dividends` | 목록·필터 | ✅ 19건, yfinance, 보유 추정 표시 |
| 8 | Settings 통화 | `/settings` | base_currency 변경 → 대시보드 KPI 반영 | ✅ USD·JPY 변경 시 KPI·순자산 차트 Y축 반영 (2026-06-21) |

**추가 페이지 (B.5 외, Joseph 2026-06-21 확인):**

| URL | 결과 |
|-----|------|
| `/wealth` | ✅ 순자산 75,500,967원, 부동산·유가증권·부채 breakdown |
| `/stocks` | ✅ 관심종목 4개, Core/Satellite, 평가금액 |
| `/disclosures` | ✅ 공시 목록 정상 |
| `/signals` | ✅ 시그널 18건 (HIGH/MEDIUM/LOW) — ⚠️ 상단 KPI 카운트 불일치 가능 |
| `/journal` | ✅ 거래 4건 (INIT 3 + BUY 1) |
| `/discover` 스크리너 | ✅ 필터 UI — 결과 0건(조건 미실행 또는 미보유 필터) |
| `/discover` AI 스코어보드 | ✅ 동서 A(93), 레이더·순위 |

- [x] B.5 핵심 8항목 **전부 확인** (2026-06-21 Joseph)

**스크리너 범위 (Joseph 확인 2026-06-21):**

| 질문 | 답 |
|------|-----|
| KRX/전체 시장 검색? | ❌ **미지원** — `stocks` 테이블(관심종목)만 대상 |
| prod 등록 종목 | 5개 (활성 4: 026960, 059090, 069500, MDLZ) |
| 「보유: 전체」 의미 | 관심종목 중 보유/미보유 필터 (시장 전체 아님) |
| 새 종목 추가 | 설정 → 신규 종목 추가 (또는 `/api/discover/add`) |
| 전체 시장 스크리너 | Phase 3 백로그 (종목 마스터 DB 필요) |

**관찰된 P2 이슈 (prod 동작은 OK, 개선 후보):**

| 이슈 | 페이지 | 비고 |
|------|--------|------|
| 시그널 KPI 카운트 | `/signals` | 목록에 HIGH/MEDIUM 있으나 상단 카드 0 표시 |
| 배당 2024 추정 합계 | `/dividends` | KPI 1,291원 vs 테이블 동서 12월 2,314,000원 — 집계 로직 점검 |
| pay_date 공백 | `/dividends` | yfinance 한계 (문서화됨) |
| MDLZ 단가 표기 | `/journal` | $60 → ₩60 표기 (통화 심볼) |

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

- [x] holding_snapshot cron 2영업일+ 데이터 존재 (prod 86 rows, 6/16~6/21)
- [x] `/` PortfolioPerformanceChart에 수익률 라인 표시 (Joseph 2026-06-21 스크린샷)
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
