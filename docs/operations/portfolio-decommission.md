# GSF-Portfolio 폐기 체크리스트 (Phase 5)

Investor 통합 코드 배포·검증 후 수행합니다.

## 사전 조건

- [ ] Investor Production: `/wealth`, `/journal`, `/` 대시보드 정상
- [ ] `npm run db:wealth-schema` (또는 동일 SQL) **프로덕션 Turso** 적용 완료
- [ ] `scripts/import_wealth_from_sheets.py` 프로덕션 seed 완료 (또는 `/wealth`에서 수동 입력)
- [ ] Vercel `CRON_SECRET` 설정 + `/api/cron/net-worth-snapshot` 1회 수동 호출 성공
- [ ] Telegram 순자산 알림 수신 확인 (선택)

## Vercel

- [ ] `gsf-portfolio-web` 프로젝트 **Pause** 또는 삭제
- [ ] Portfolio 도메인이 있으면 Investor URL로 **308 리다이렉트**
- [ ] Portfolio cron (`/api/cron/snapshot`) 비활성 — Investor `vercel.json` cron만 유지

## GitHub

- [ ] `asiaunion/gsf-portfolio-web` → **Archive**
- [ ] Archive README: `Merged into gsf-investor — use /wealth and /journal`

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
