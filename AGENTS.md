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
