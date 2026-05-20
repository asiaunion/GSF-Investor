# GSF-Portfolio 폐기 체크리스트 (Phase 5)

Investor 통합 코드 배포·검증 후 수행합니다.

## 사전 조건

- [x] Investor Production: `/wealth`, `/journal`, `/` 대시보드 정상
- [x] `npm run db:wealth-schema` (또는 동일 SQL) **프로덕션 Turso** 적용 완료
- [x] `scripts/import_wealth_from_sheets.py` 프로덕션 seed 완료 (mock; `/wealth`에서 검토 권장)
- [x] Vercel `CRON_SECRET` 설정 + `/api/cron/net-worth-snapshot` 스모크 200
- [ ] Telegram 순자산 알림 수신 확인 (선택 — Investor env 미설정)

## Vercel

- [x] `gsf-portfolio-web` — cron 제거, **308 →** `https://gsf-investor.vercel.app/wealth` (2026-05-20 배포)
- [x] 커스텀 도메인 없음 (`gsf-portfolio-web.vercel.app`만 사용)
- [x] Portfolio cron (`/api/cron/snapshot`) 비활성 — Investor `vercel.json` cron만 유지
- [x] `APP_PIN` Production env 제거

## GitHub

- [ ] `asiaunion/gsf-portfolio-web` → **Archive** (수동: GitHub → Settings → Archive)
- [x] README: Investor `/wealth`, `/journal` 안내 (`d26fe7a`)

## 로컬

```bash
tar -czf ~/backup-gsf-portfolio-$(date +%Y%m%d).tar.gz \
  /Users/gsf/.gemini/antigravity/scratch/projects/GSF-Portfolio
# 검증 후 폴더 삭제 (선택)
```

## 시크릿 정리

- Portfolio 전용: `APP_PIN`, `APP_SESSION_TOKEN` — Vercel에서 제거
- Investor에 유지: `TURSO_*`, `TELEGRAM_*`, `CRON_SECRET`, (import 1회용) `GSHEETS_*` / `GCP_*`

## 관련 문서

- [wealth-migration-report.md](./wealth-migration-report.md)
