# AG / Cursor 글로벌 규칙 스니펫 (복사용)

GSF-Investor 및 유사 프로젝트에서 Antigravity·Cursor user rules에 붙여 넣을 내용입니다.

---

## GSF-Investor AG Safe Session

레포에 `npm run ag:session:*` 스크립트가 있을 때:

1. 세션 **첫 코드 변경 전**: `npm run ag:session:start`
2. **프로덕션 Turso 쓰기** (`REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE`) 또는 **`vercel deploy --prod` 직전**: `npm run ag:session:checkpoint`
3. 사용자가 원상복구·롤백 요청 시: `npm run ag:session:rollback -- --all --dry-run` → 확인 후 `--yes`
4. `main`에서 직접 작업·push 금지
5. Vercel/AWS/GitHub 대시보드에서 시크릿 추출·Build Command 변경 금지 (browser MCP 금지)

상세: 레포 `docs/operations/ag-safe-session.md`, `AGENTS.md`

---

## 백업 습관 (antigravity-agent migrate.sh와 동일)

- 대규모 리팩터/테마 병합 전: `git stash push -u -m "manual-backup-YYYYMMDD"`
- 디자인 확정: `npm run design:capture` 또는 `scripts/snapshot.sh` (GSF-Investor)
