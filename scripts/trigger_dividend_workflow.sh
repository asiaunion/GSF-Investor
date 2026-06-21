#!/usr/bin/env bash
# GitHub Actions: Weekly Dividend Calendar Update (workflow_dispatch)
# Prerequisites: gh auth login
set -euo pipefail

REPO="${GITHUB_REPO:-asiaunion/GSF-Investor}"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI 필요: brew install gh && gh auth login"
  exit 1
fi

gh workflow run "Weekly Dividend Calendar Update" -R "$REPO"
echo "✅ workflow_dispatch 요청됨"
echo "→ gh run list -R $REPO --workflow='Weekly Dividend Calendar Update' --limit 3"
