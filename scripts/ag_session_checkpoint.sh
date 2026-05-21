#!/usr/bin/env bash
# Refresh checkpoint: tag, Turso export, Vercel production deployment id.
# Usage: ./scripts/ag_session_checkpoint.sh
set -euo pipefail

source "$(dirname "$0")/ag_session_lib.sh"

cd "$ROOT"
require_manifest

SID="$(manifest_get session_id)"
TAG="checkpoint/ag-${SID}"
EXPORT_PATH="backups/ag-sessions/${SID}.db"
ISO="$(iso_utc_now)"

git tag -f -a "$TAG" -m "AG session checkpoint ${SID} at ${ISO}"

turso_export_db "$EXPORT_PATH" || true

capture_vercel_production || true

python3 scripts/ag_session_manifest.py update \
  --checkpointed \
  --tag "$TAG" \
  --commit "$(git rev-parse HEAD)" \
  --turso-export "$EXPORT_PATH" \
  --turso-iso "$ISO"

echo ""
echo "========================================="
echo "AG session checkpoint updated"
echo "  tag:       $TAG"
echo "  turso:     $EXPORT_PATH"
echo "  manifest:  $AG_SESSION_MANIFEST"
echo "  Prod writes / deploy --prod are now allowed (see AGENTS.md)."
echo "========================================="
