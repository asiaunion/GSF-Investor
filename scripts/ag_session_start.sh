#!/usr/bin/env bash
# Start an AG safe session: feature branch, git tag, Turso export, manifest.
# Usage: ./scripts/ag_session_start.sh [optional-label]
set -euo pipefail

source "$(dirname "$0")/ag_session_lib.sh"

cd "$ROOT"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "⚠️  Working tree has uncommitted tracked changes."
  echo "   Stashing before session start (untracked files are kept)..."
  git stash push -m "ag-session-autostash-$(session_id)"
fi

SID="$(session_id)"
LABEL="${1:-}"
BRANCH="ui/ag-${SID}${LABEL:+-${LABEL}}"
TAG="checkpoint/before-${SID}"
EXPORT_PATH="backups/ag-sessions/${SID}.db"
ISO="$(iso_utc_now)"

if git show-ref --verify --quiet "refs/tags/${TAG}" 2>/dev/null; then
  echo "❌ Tag already exists: $TAG"
  exit 1
fi

git checkout -b "$BRANCH"
git tag -a "$TAG" -m "AG session checkpoint before ${SID}"

COMMIT="$(git rev-parse HEAD)"

if ! turso_export_db "$EXPORT_PATH"; then
  EXPORT_PATH=""
  if [[ "${AG_ALLOW_NO_DB_BACKUP:-0}" == "1" ]]; then
    echo "⚠️  WARNING: Turso export failed. DB rollback will NOT be available."
    echo "   --db rollback will fail for this session. Continuing because AG_ALLOW_NO_DB_BACKUP=1."
  else
    echo "❌ ERROR: Turso export failed. Cannot start session without DB backup."
    echo "   --db rollback will be unavailable, risking unrecoverable prod data loss."
    echo "   To skip backup and continue anyway: AG_ALLOW_NO_DB_BACKUP=1 npm run ag:session:start"
    exit 1
  fi
fi

python3 scripts/ag_session_manifest.py init \
  --session-id "$SID" \
  --branch "$BRANCH" \
  --tag "$TAG" \
  --commit "$COMMIT" \
  --turso-export "$EXPORT_PATH" \
  --turso-iso "$ISO"

export AG_SESSION_CHECKPOINTED=false

echo ""
echo "========================================="
echo "AG session started"
echo "  branch:    $BRANCH"
echo "  tag:       $TAG"
echo "  commit:    $COMMIT"
echo "  manifest:  $AG_SESSION_MANIFEST"
echo "  turso:     ${EXPORT_PATH:-skipped}"
echo ""
echo "Before prod DB write or vercel deploy --prod:"
echo "  npm run ag:session:checkpoint"
echo "========================================="
