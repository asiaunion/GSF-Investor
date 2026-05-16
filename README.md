# GSF-Investor

개인 투자 시스템 — 자동 모니터링 + AI 분석 + 매매 일지 + 종목 발굴

## 스택

- **프론트엔드**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **DB**: Turso (libSQL 서버리스 SQLite)
- **ORM**: Drizzle ORM
- **인증**: NextAuth v5 (Google OAuth, 1인 전용)
- **데이터 수집**: GitHub Actions + Python (DART/SEC/Yahoo Finance)
- **AI**: Gemini API (gemini-2.5-flash)
- **배포**: Vercel

## Phase 1 체크리스트

- [x] Day 1-2: 리포 + Next.js + Turso + Drizzle 스키마 + NextAuth
- [ ] Day 3: `scripts/seed_portfolio.py` — 종목 시딩 + INIT + 과거 데이터 벌크
- [ ] Day 4-5: 매매 일지 CRUD
- [ ] Day 6-7: `scripts/daily_price.py` + GitHub Actions 크론
- [ ] Day 8-9: 포트폴리오 대시보드 (v_portfolio View 연동)
- [ ] Day 10-11: 종목 상세 페이지 (Overview + 재무 Recharts)

## 초기 세팅

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## DB 명령어

```bash
npm run db:generate   # 스키마 변경 후 마이그레이션 생성
npm run db:migrate    # Turso에 마이그레이션 적용
npm run db:push       # 개발 시 스키마 직접 푸시
npm run db:studio     # Drizzle Studio (로컬 DB GUI)
```

## Turso 설치 및 DB 생성

```bash
brew install tursodatabase/tap/turso
turso auth login
turso db create gsf-investor
turso db show gsf-investor
turso db tokens create gsf-investor
```
