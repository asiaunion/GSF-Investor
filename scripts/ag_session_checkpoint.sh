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

# ─── GSF-OS Layer 0: transcript 스냅샷 자동 연동 ──────────────────────────
# checkpoint 실행 시점 = 프로덕션 쓰기 직전 → 가장 안전한 백업 타이밍.
# backup_transcript.sh 실패 시 경고만 출력하고 checkpoint 자체는 성공으로 처리.
BACKUP_SCRIPT="${HOME}/.gemini/antigravity/scratch/projects/GSF-OS/scripts/backup_transcript.sh"
if [[ -x "$BACKUP_SCRIPT" ]]; then
  echo ""
  echo "🔄 GSF-OS Layer 0: transcript 백업 연동..."
  bash "$BACKUP_SCRIPT" || echo "⚠️  transcript 백업 실패 — checkpoint 자체는 완료됨"
else
  echo "⚠️  backup_transcript.sh 미발견 ($BACKUP_SCRIPT) — transcript 백업 생략"
fi
