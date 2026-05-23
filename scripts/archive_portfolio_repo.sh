#!/usr/bin/env bash
# GSF-Portfolio GitHub archive (수동 1회)
# Prerequisites: gh auth login
# Usage: ./scripts/archive_portfolio_repo.sh

set -euo pipefail

REPO="${GITHUB_PORTFOLIO_REPO:-asiaunion/gsf-portfolio-web}"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI 필요: brew install gh && gh auth login"
  exit 1
fi

echo "→ Archive $REPO"
read -r -p "계속할까요? [y/N] " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "취소됨"
  exit 0
fi

gh repo archive "$REPO" --yes
echo "✅ Archived. 확인: gh repo view $REPO --json isArchived"
