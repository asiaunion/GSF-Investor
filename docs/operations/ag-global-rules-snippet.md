# AG / Cursor 글로벌 규칙 스니펫 (복사용)

> GEMINI.md §2.5 "프로젝트 AGENTS.md 자동 준수"가 이미 로드되어 있습니다.
> 아래는 프로젝트별 참조 링크만 모은 것입니다.

---

## GSF-Investor

- AGENTS.md: `projects/GSF-Investor/AGENTS.md`
- 전체 흐름: `docs/operations/ag-safe-session-for-ag.md`
- 사용자 프롬프트: `docs/operations/ag-prompts-ko.md`

---

## 백업 습관 (antigravity-agent migrate.sh와 동일)

- 대규모 리팩터/테마 병합 전: `git stash push -u -m "manual-backup-YYYYMMDD"`
- 디자인 확정: `npm run design:capture` 또는 `scripts/snapshot.sh` (GSF-Investor)
