<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Secrets and environment variables (mandatory)

Full guide: [docs/operations/secret-handling.md](docs/operations/secret-handling.md)

### Never do

- Do **not** use the **browser MCP / browser subagent** to open Vercel, AWS, GCP, GitHub, or similar dashboards to reveal, copy, or extract API keys, tokens, passwords, or other secrets (incident: 2026-05-20, malicious Production Build Command injection on GSF-Investor).
- Do **not** change Vercel **Production Overrides**, **Build Command**, or trigger redeploys to “read” environment variables.
- Do **not** paste secret values into chat, commits, screenshots, or markdown docs.
- Do **not** trust a subagent’s “recovery complete” report without the user verifying settings manually.

### Allowed

- Write secrets to `.env.local` only when the **user pastes** values in chat or confirms they edited the file locally.
- Sync **Turso** via CLI: `python3 scripts/sync_env_local.py` (never browser).
- Run `vercel env pull` / Vercel API only to check **whether** keys exist; Sensitive values arrive empty by design—tell the user to set them in the Vercel UI manually.
- After a suspected leak, instruct **rotation** (Turso token, Gemini, Google OAuth secret, `AUTH_SECRET`, DART) per `secret-handling.md`—do not attempt automated extraction to fix it.

## AG safe session (mandatory for multi-file or prod work)

Full guide: [docs/operations/ag-safe-session.md](docs/operations/ag-safe-session.md)  
Agent flow + user prompts: [docs/operations/ag-safe-session-for-ag.md](docs/operations/ag-safe-session-for-ag.md), [docs/operations/ag-prompts-ko.md](docs/operations/ag-prompts-ko.md)

### Automation (Cursor)

- **sessionStart** hook runs `ag:session:start` when no manifest (see `.cursor/hooks.json`).
- **beforeShellExecution** hook runs `ag:session:checkpoint` before prod Turso / `vercel deploy --prod`.

### Session workflow

1. **Start** — On session start, hook runs start if needed; otherwise confirm with `npm run ag:session:status`.
2. **Checkpoint** — Hook auto-runs before prod writes/deploy; if hooks unavailable (e.g. Antigravity-only), run `npm run ag:session:checkpoint` manually before those commands.
3. **Status** — `npm run ag:session:status` to inspect diff vs checkpoint.
4. **Rollback** — If the user says revert / restore / 원상복구: `npm run ag:session:rollback -- --all --dry-run` first, then `--yes` after confirmation. Do **not** use partial `git checkout origin/main -- <files>` unless the user explicitly names paths and a documented tag.

### Never do (AG runaway prevention)

- Work or commit directly on `main` (pre-push hook blocks push; use feature branches).
- Prod Turso writes or production deploy without a prior checkpoint in `.ag-session.json`.
- “Fix” a bad restore by re-seeding production data without reading the manifest and [ag-restore-guide-2026-05-21.md](docs/operations/ag-restore-guide-2026-05-21.md).

### Allowed without checkpoint

- Edits on the session feature branch, `DRY_RUN=1` data scripts, `npm run build`, local `npm run dev`.

## Antigravity 자동 세션 (hooks 없는 환경)

Cursor hooks가 없는 에이전트(Antigravity 등)는 GEMINI.md §2.5에 따라 다음을 **직접** 실행해야 합니다:

1. **세션 시작 (최초 1회)**:
   ```bash
   npm run ag:session:status  # 기존 세션 확인
   npm run ag:session:start   # 없으면 시작
   ```
2. **위험 명령 직전**: `npm run ag:session:checkpoint`
3. **롤백**: `npm run ag:session:rollback -- --all --dry-run` → 사용자 확인 → `--yes`

이 절차를 건너뛰고 프로덕션 명령을 실행하면 `real_data_guard.py`가 차단합니다.
