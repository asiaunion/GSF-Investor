# GSF-Investor

개인 투자 시스템 — 자동 모니터링 + AI 분석 + 매매 일지 + 종목 발굴

## 스택

- **프론트엔드**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **DB**: Turso (libSQL 서버리스 SQLite)
- **ORM**: Drizzle ORM
- **인증**: NextAuth v5 (Google OAuth, 1인 전용)
- **데이터 수집**: GitHub Actions + Python (DART/SEC/Yahoo Finance)
- **AI**: Gemini API (gemini-2.5-flash)
- **배포**: Vercel

## Phase 1 체크리스트

- [x] Day 1-2: 리포 + Next.js + Turso + Drizzle 스키마 + NextAuth
- [x] Day 3: `scripts/seed_portfolio.py` — 종목 시딩 + INIT + 과거 데이터 벌크
- [x] Day 4-5: 매매 일지 CRUD
- [x] Day 6-7: `scripts/daily_price.py` + GitHub Actions 크론
- [x] Day 8-9: 포트폴리오 대시보드 (v_portfolio View 연동)
- [x] Day 10-11: 종목 상세 페이지 (Overview + 재무 Recharts)

## 초기 세팅

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## 디자인 로컬 검증 (Turso / Google OAuth 없이)

Economist UI 전 페이지를 이 워크스페이스에서 바로 볼 수 있습니다.

```bash
cp .env.example .env.local   # 최초 1회
npm run db:dev:setup         # local.db + 데모 데이터 + signal_rules + views
npm run dev:preview          # http://localhost:3000
```

브라우저에서 **로그인 → 「디자인 프리뷰 (로그인 없이)」** 클릭 후 모든 메뉴를 탐색하세요.

```bash
npm run design:capture       # screenshots/verify/*.png (종목·보고서 상세 포함)
```

> `.env.local`에 `VERCEL=1`이 있어도 `next dev`에서는 `local.db`를 사용합니다.

## DB 명령어

```bash
npm run db:generate   # 스키마 변경 후 마이그레이션 생성
npm run db:migrate    # Turso에 마이그레이션 적용
npm run db:push       # 개발 시 스키마 직접 푸시
npm run db:studio     # Drizzle Studio (로컬 DB GUI)
npm run db:views      # v_portfolio 뷰 적용 (로컬/TURSO_DATABASE_URL)
```

### 프로덕션(Turso DB) 마이그레이션 및 뷰 적용 절차
스키마가 변경되었을 때, 실서버(Turso DB)에 마이그레이션과 SQL 뷰를 적용하는 단계입니다:

1. **마이그레이션 파일 생성** (로컬 개발 완료 시점):
   ```bash
   npm run db:generate
   ```
2. **원격 Turso DB에 스키마 마이그레이션 적용** (`REAL_DATA_RUN_ACK` 환경변수 필수):
   ```bash
   REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE npm run db:migrate
   ```
3. **원격 Turso DB에 SQL 뷰(`v_portfolio`) 생성/업데이트**:
   ```bash
   REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE npm run db:views
   ```

## 운영·실데이터 수동 검증

원격 DB에 직접 쓰는 배치를 로컬에서 돌리기 전에 [실데이터 수동 검증 런북](docs/operations/real-data-manual-validation.md)을 따르세요.  
`REAL_DATA_RUN_ACK` / `DRY_RUN`은 `scripts/real_data_guard.py` 및 해당 문서를 참고합니다.

재무·밸류에이션(PER/PBR/ROE 등) 숫자 정확도는 [재무 데이터 검증 런북](docs/operations/financial-data-validation.md) 및 `scripts/validate_financials_dart.py` / `scripts/validate_valuation_metrics.py`를 사용합니다.

**GSF-Portfolio 통합** — 전체 순자산·비주식 자산은 [`/wealth`](http://localhost:3000/wealth) 및 [자산 이관 런북](docs/operations/wealth-migration-report.md). 주식 포지션은 매매 일지에서 재입력합니다. Portfolio 앱 폐기: [portfolio-decommission.md](docs/operations/portfolio-decommission.md).

## 시크릿·환경변수 (필수)

API 키 로컬화·Vercel 설정 시 [시크릿 취급 가이드](docs/operations/secret-handling.md)를 따르세요. **브라우저 에이전트로 대시보드에서 시크릿을 추출하는 것은 금지**입니다 (2026-05-20 보안 사고).

로컬 `.env.local` 동기화 (Turso CLI + Vercel API에 값이 있을 때만):

```bash
python3 scripts/sync_env_local.py
```

## Turso 설치 및 DB 생성

```bash
brew install tursodatabase/tap/turso
turso auth login
turso db create gsf-investor
turso db show gsf-investor
turso db tokens create gsf-investor
```

## 데이터 수집·Cron (KST)

v2 [§4.3](docs/specs/2026-05-21-investor-upgrade-design-v2.md) 기준. GitHub Actions는 **UTC cron** → 아래는 **한국 시각** 환산.

| 작업 | 주기 (KST) | 구현 | 수동 실행 |
|------|------------|------|-----------|
| 종가·USDKRW | 평일 **07:00** | `.github/workflows/daily_price.yml` → `scripts/daily_price.py` | workflow_dispatch |
| DART·SEC 공시 | 평일 **07:30** | `.github/workflows/daily_dart.yml` | workflow_dispatch |
| 보유 일별 스냅샷 | 평일 **18:00** | `.github/workflows/holding_snapshot.yml` → `scripts/holding_snapshot.py` | workflow_dispatch |
| 배당 캘린더 | 일요일 **22:00** | `.github/workflows/update_dividend_calendar.yml` → `scripts/update_dividend_calendar.py` | workflow_dispatch |
| 주간 시그널 | 일요일 **21:00** | `.github/workflows/weekly_signal.yml` | workflow_dispatch |
| 순자산 스냅샷 | 매일 **00:00** (Vercel) | `vercel.json` → `GET /api/cron/net-worth-snapshot` | curl + `CRON_SECRET` |

Prod DB 쓰기: `REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE` ([실데이터 검증](docs/operations/real-data-manual-validation.md)).

### 운영 스모크

```bash
./scripts/smoke_net_worth_cron.sh
# Production: BASE_URL=https://gsf-investor.vercel.app CRON_SECRET=... ./scripts/smoke_net_worth_cron.sh
```

Portfolio 레포 archive: `./scripts/archive_portfolio_repo.sh` (requires `gh auth login`).

고도화 설계: [v2 스펙](docs/specs/2026-05-21-investor-upgrade-design-v2.md) · Phase 2b: [phase-2b-backlog.md](docs/operations/phase-2b-backlog.md)

## 손익 기준 안내

| 화면 | 기준 |
|------|------|
| 대시보드 보유 수익률 | 가중평균 매입단가 (`v_portfolio`) |
| 매매 일지 분석 | FIFO 실현손익 (`src/lib/fifo.ts`) |

## CI

`push` / `pull_request` 시 GitHub Actions에서 `lint`, `test`, `build`를 실행합니다.
