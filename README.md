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

## Turso 설치 및 DB 생성

```bash
brew install tursodatabase/tap/turso
turso auth login
turso db create gsf-investor
turso db show gsf-investor
turso db tokens create gsf-investor
```

## 손익 기준 안내

| 화면 | 기준 |
|------|------|
| 대시보드 보유 수익률 | 가중평균 매입단가 (`v_portfolio`) |
| 매매 일지 분석 | FIFO 실현손익 (`src/lib/fifo.ts`) |

## CI

`push` / `pull_request` 시 GitHub Actions에서 `lint`, `test`, `build`를 실행합니다.
