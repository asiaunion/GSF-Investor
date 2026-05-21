#!/usr/bin/env bash
# Roll back AG session using manifest checkpoint.
# Usage: ./scripts/ag_session_rollback.sh [--code|--db|--deploy|--all] [--yes] [--dry-run]
set -euo pipefail

source "$(dirname "$0")/ag_session_lib.sh"

cd "$ROOT"
require_manifest

MODE="all"
YES=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --code) MODE="code" ;;
    --db) MODE="db" ;;
    --deploy) MODE="deploy" ;;
    --all) MODE="all" ;;
    --yes) YES=true ;;
    --dry-run) DRY_RUN=true ;;
    -h|--help)
      echo "Usage: $0 [--code|--db|--deploy|--all] [--yes] [--dry-run]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

TAG="$(manifest_get git.checkpoint_tag)"
EXPORT="$(manifest_get turso.export_path)"
TURSO_ISO="$(manifest_get turso.checkpoint_iso)"
VERCEL_URL="$(manifest_get vercel.deployment_url)"
VERCEL_ID="$(manifest_get vercel.deployment_id)"
SID="$(manifest_get session_id)"

rollback_code() {
  if [[ -z "$TAG" ]]; then
    echo "❌ No git.checkpoint_tag in manifest"
    return 1
  fi
  if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "❌ Tag not found: $TAG"
    return 1
  fi
  if $DRY_RUN; then
    echo "[dry-run] git reset --hard $TAG"
    git diff --stat "$TAG"..HEAD || true
    return 0
  fi
  if ! $YES; then
    echo "Code rollback will: git reset --hard $TAG"
    echo "Re-run with --yes to apply."
    return 1
  fi
  git reset --hard "$TAG"
  echo "✅ Code rolled back to $TAG"
}

rollback_db() {
  if [[ -z "$EXPORT" || ! -f "$EXPORT" ]]; then
    echo "❌ Turso export not found: ${EXPORT:-missing}"
    return 1
  fi

  local branch_name="gsf-investor-restore-${SID}"
  echo "Turso rollback options:"
  echo "  A) Point-in-time branch (if checkpoint_iso set)"
  echo "  B) Import export into new database: $branch_name"

  if $DRY_RUN; then
    echo "[dry-run] export file: $EXPORT ($(du -h "$EXPORT" | awk '{print $1}'))"
    if [[ -n "$TURSO_ISO" ]]; then
      echo "[dry-run] turso db branch $TURSO_DB $branch_name --timestamp $TURSO_ISO"
    fi
    echo "[dry-run] turso db import $EXPORT"
    return 0
  fi

  if ! $YES; then
    echo "DB rollback is destructive. Re-run with --yes."
    return 1
  fi

  if [[ -n "$TURSO_ISO" ]] && command -v turso >/dev/null 2>&1; then
    echo "Creating PIT branch from $TURSO_ISO ..."
    if turso db branch "$TURSO_DB" "$branch_name" --timestamp "$TURSO_ISO" 2>/dev/null; then
      echo "✅ Branch created: $branch_name"
      turso db show "$branch_name" --url 2>/dev/null || true
      echo "   Update Vercel TURSO_DATABASE_URL to this URL if you want to use the branch."
      return 0
    fi
    echo "⚠️  PIT branch failed — falling back to import"
  fi

  if ! command -v turso >/dev/null 2>&1; then
    echo "❌ turso CLI required"
    return 1
  fi

  turso db import "$EXPORT"
  echo "✅ Imported $EXPORT (database name = file basename without .db)"
  echo "   Run: turso db show <imported-name> --url"
  echo "   Update Vercel TURSO_DATABASE_URL if replacing production."
}

rollback_deploy() {
  local target="${VERCEL_ID:-$VERCEL_URL}"
  if [[ -z "$target" ]]; then
    echo "❌ No vercel.deployment_id or deployment_url in manifest"
    echo "   Run npm run ag:session:checkpoint after a production deploy."
    return 1
  fi
  if $DRY_RUN; then
    echo "[dry-run] npx vercel rollback $target --yes"
    return 0
  fi
  if ! $YES; then
    echo "Deploy rollback will: vercel rollback $target"
    echo "Re-run with --yes to apply."
    return 1
  fi
  npx vercel rollback "$target" --yes
  echo "✅ Vercel rolled back toward checkpoint deployment"
}

FAIL=0

case "$MODE" in
  code) rollback_code || FAIL=1 ;;
  db) rollback_db || FAIL=1 ;;
  deploy) rollback_deploy || FAIL=1 ;;
  all)
    rollback_code || FAIL=1
    rollback_db || FAIL=1
    rollback_deploy || FAIL=1
    ;;
esac

exit "$FAIL"
