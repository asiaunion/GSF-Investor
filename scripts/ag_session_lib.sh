#!/usr/bin/env bash
# Shared helpers for AG safe session scripts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export AG_SESSION_MANIFEST="${AG_SESSION_MANIFEST:-$ROOT/.ag-session.json}"
BACKUP_DIR="$ROOT/backups/ag-sessions"
TURSO_DB="${TURSO_DB:-gsf-investor}"
VERCEL_PROJECT="${VERCEL_PROJECT:-gsf-investor}"

session_id() {
  date +%Y%m%d_%H%M%S
}

iso_utc_now() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

require_manifest() {
  if [[ ! -f "$AG_SESSION_MANIFEST" ]]; then
    echo "❌ No AG session manifest at $AG_SESSION_MANIFEST"
    echo "   Run: npm run ag:session:start"
    exit 1
  fi
}

manifest_get() {
  python3 "$ROOT/scripts/ag_session_manifest.py" get --key "$1" 2>/dev/null || true
}

turso_export_db() {
  local out_path="$1"
  mkdir -p "$(dirname "$out_path")"
  if ! command -v turso >/dev/null 2>&1; then
    echo "⚠️  turso CLI not found — skipping DB export"
    return 1
  fi
  turso db export "$TURSO_DB" --output-file "$out_path" --overwrite
  echo "✅ Turso export: $out_path"
}

capture_vercel_production() {
  if ! command -v npx >/dev/null 2>&1; then
    echo "⚠️  npx not found — skipping Vercel capture"
    return 1
  fi
  local tmp url id
  tmp="$(mktemp)"
  if ! npx vercel list "$VERCEL_PROJECT" -F json --environment production 2>/dev/null >"$tmp"; then
    rm -f "$tmp"
    echo "⚠️  vercel list failed — skipping Vercel capture"
    return 1
  fi
  url="$(python3 -c "
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data = json.load(f)
deps = data.get('deployments') or []
if not deps:
    raise SystemExit(1)
u = deps[0].get('url') or ''
if not u.startswith('http'):
    u = 'https://' + u
print(u)
" "$tmp")" || url=""
  rm -f "$tmp"
  if [[ -z "$url" ]]; then
    echo "⚠️  no production deployment URL found"
    return 1
  fi
  # 2) vercel inspect -F json for deployment ID (stable JSON parsing)
  local inspect_json
  inspect_json="$(npx vercel inspect "$url" -F json 2>/dev/null)" || inspect_json=""
  if [[ -n "$inspect_json" ]]; then
    id="$(python3 -c "
import json, sys
data = json.loads(sys.argv[1])
print(data.get('id') or data.get('uid') or '')
" "$inspect_json")" || id=""
  fi

  if [[ -n "$id" ]]; then
    python3 "$ROOT/scripts/ag_session_manifest.py" update --vercel-url "$url" --vercel-id "$id"
  else
    python3 "$ROOT/scripts/ag_session_manifest.py" update --vercel-url "$url"
  fi
  echo "✅ Vercel checkpoint: ${id:-unknown-id} $url"
}
