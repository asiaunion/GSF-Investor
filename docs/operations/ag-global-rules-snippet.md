# AG / Cursor 글로벌 규칙 스니펫 (복사용)

GSF-Investor 및 유사 프로젝트에서 Antigravity·Cursor user rules에 붙여 넣을 내용입니다.

---

## GSF-Investor AG Safe Session

레포: `docs/operations/ag-safe-session-for-ag.md` (전체 흐름), `docs/operations/ag-prompts-ko.md` (사용자 프롬프트)

1. 세션 시작: manifest 없으면 `npm run ag:session:start` (Cursor는 훅이 자동 실행)
2. prod Turso / `vercel deploy --prod` 전: `ag:session:checkpoint` (Cursor 훅이 자동 실행)
3. 롤백: `ag:session:rollback -- --all --dry-run` → 확인 → `--yes`
4. `main` 작업·push 금지; browser MCP로 Vercel 시크릿 금지

Antigravity만 쓸 때: 사용자가 `ag-prompts-ko.md` §7 또는 §1 프롬프트를 붙여 넣으면 동일 절차.

---

## 백업 습관 (antigravity-agent migrate.sh와 동일)

- 대규모 리팩터/테마 병합 전: `git stash push -u -m "manual-backup-YYYYMMDD"`
- 디자인 확정: `npm run design:capture` 또는 `scripts/snapshot.sh` (GSF-Investor)
