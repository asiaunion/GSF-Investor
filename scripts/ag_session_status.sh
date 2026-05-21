#!/usr/bin/env bash
# Show AG session manifest and diff vs checkpoint tag.
set -euo pipefail

source "$(dirname "$0")/ag_session_lib.sh"

cd "$ROOT"

if [[ ! -f "$AG_SESSION_MANIFEST" ]]; then
  echo "No active AG session (missing $AG_SESSION_MANIFEST)"
  echo "Start one with: npm run ag:session:start"
  exit 0
fi

echo "=== AG session manifest ==="
python3 scripts/ag_session_manifest.py print

TAG="$(manifest_get git.checkpoint_tag)"
BRANCH="$(manifest_get git.branch)"

echo ""
echo "=== Git ==="
echo "  current branch: $(git rev-parse --abbrev-ref HEAD)"
echo "  session branch: ${BRANCH:-?}"
echo "  checkpoint tag: ${TAG:-?}"

if [[ -n "$TAG" ]] && git rev-parse "$TAG" >/dev/null 2>&1; then
  echo ""
  echo "  diff vs checkpoint (stat):"
  git diff --stat "$TAG"..HEAD 2>/dev/null || git diff --stat "$TAG" HEAD
fi

EXPORT="$(manifest_get turso.export_path)"
if [[ -n "$EXPORT" && -f "$EXPORT" ]]; then
  echo ""
  echo "=== Turso backup ==="
  ls -lh "$EXPORT"
fi

VERCEL_URL="$(manifest_get vercel.deployment_url)"
if [[ -n "$VERCEL_URL" ]]; then
  echo ""
  echo "=== Vercel checkpoint ==="
  echo "  url: $(manifest_get vercel.deployment_url)"
  echo "  id:  $(manifest_get vercel.deployment_id)"
fi

CHECKPOINTED="$(manifest_get checkpointed)"
echo ""
if [[ "$CHECKPOINTED" == "True" || "$CHECKPOINTED" == "true" ]]; then
  echo "checkpointed: yes (prod writes allowed with REAL_DATA_RUN_ACK)"
else
  echo "checkpointed: no — run npm run ag:session:checkpoint before prod DB/deploy"
fi
