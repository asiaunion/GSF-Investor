# GSF-Portfolio 폐기 체크리스트 (Phase 5) — 완료

Investor 통합·GitHub/Vercel/로컬 정리 완료 (2026-05-23).

## 사전 조건

- [x] Investor Production: `/wealth`, `/journal`, `/` 대시보드 정상
- [x] `npm run db:wealth-schema` (또는 동일 SQL) **프로덕션 Turso** 적용 완료
- [x] `scripts/import_wealth_from_sheets.py` 프로덕션 seed 완료 (mock; `/wealth`에서 검토 권장)
- [x] Vercel `CRON_SECRET` 설정 + `/api/cron/net-worth-snapshot` 스모크 200
- [x] Telegram 순자산 알림 — `gsf_investor` (2026-05-23)
- [x] 순자산 cron 스모크: HTTP 200 (2026-05-23, prod `netWorth` 스냅샷 INSERT 확인)

## Vercel

- [x] `gsf-portfolio-web` — cron 제거, **308 →** Investor `/wealth` (2026-05-20 배포)
- [x] **Vercel 프로젝트 삭제** (2026-05-23) — `gsf-portfolio-web.vercel.app` 더 이상 사용 안 함
- [x] Portfolio cron (`/api/cron/snapshot`) 비활성 — Investor `vercel.json` cron만 유지
- [x] `APP_PIN` Production env 제거

## GitHub

- [x] `asiaunion/gsf-portfolio-web` — Archive 후 **Delete** (2026-05-23)
- [x] README: Investor `/wealth`, `/journal` 안내 (`d26fe7a`)

**정본 URL:** https://gsf-investor.vercel.app (`/wealth`, `/journal`, `/`)

## 로컬

- [x] 백업 (`~/backup-gsf-portfolio-*.tar.gz`)
- [x] `GSF-Portfolio` 폴더 삭제 (2026-05-23)

정본 경로만 유지: `/Users/gsf/.gemini/antigravity/scratch/projects/GSF-Investor` · Cursor `GSF-Investor`

## 시크릿 정리

- Portfolio 전용: `APP_PIN`, `APP_SESSION_TOKEN` — Vercel에서 제거
- Investor에 유지: `TURSO_*`, `TELEGRAM_*`, `CRON_SECRET`, (import 1회용) `GSHEETS_*` / `GCP_*`

## 관련 문서

- [wealth-migration-report.md](./wealth-migration-report.md)
