#!/bin/bash
# GSF-Investor 승인 스냅샷 스크립트
# 사용법: ./scripts/snapshot.sh "설명" 
# 예시: ./scripts/snapshot.sh "economist-green-final"
#
# 이 스크립트는 사용자가 디자인에 만족을 표현했을 때 실행합니다.
# 1. git tag로 현재 상태를 영구 앵커링
# 2. 주요 페이지의 브라우저 스크린샷을 자동 캡처
# 3. CSS 토큰 현재값을 덤프
# 4. design-baseline.md의 승인 이력을 업데이트

set -e

DESCRIPTION=${1:-"unnamed"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TAG_NAME="v-approved-$(date +%Y%m%d)-${DESCRIPTION}"
SNAPSHOT_DIR="snapshots/${TIMESTAMP}_${DESCRIPTION}"

echo "📸 GSF-Investor 승인 스냅샷 생성 중..."
echo "   태그: ${TAG_NAME}"
echo "   디렉토리: ${SNAPSHOT_DIR}"

# 1. 디렉토리 생성
mkdir -p "${SNAPSHOT_DIR}"

# 2. Git 태그 생성
git tag -a "${TAG_NAME}" -m "Approved design: ${DESCRIPTION} at ${TIMESTAMP}"
echo "✅ Git 태그 생성: ${TAG_NAME}"

# 3. CSS 토큰 덤프
if [ -f "src/app/globals.css" ]; then
  cp "src/app/globals.css" "${SNAPSHOT_DIR}/globals.css.snapshot"
  echo "✅ CSS 토큰 스냅샷 저장"
fi

# 4. 현재 git diff 상태 저장
git log --oneline -5 > "${SNAPSHOT_DIR}/git_state.txt"
git diff --stat HEAD~1 >> "${SNAPSHOT_DIR}/git_state.txt" 2>/dev/null || true
echo "✅ Git 상태 저장"

# 5. 브라우저 스크린샷 (Playwright가 설치된 경우)
if command -v npx &> /dev/null; then
  echo "📷 브라우저 스크린샷 캡처 시도 중..."
  
  # Playwright가 없으면 스킵
  npx --yes playwright screenshot \
    --viewport-size="1280,900" \
    "http://localhost:3000" \
    "${SNAPSHOT_DIR}/dashboard.png" 2>/dev/null && \
    echo "✅ 대시보드 스크린샷 저장" || \
    echo "⚠️  Playwright 스크린샷 스킵 (dev 서버가 실행 중이어야 합니다)"
fi

# 6. 메타데이터 파일 생성
cat > "${SNAPSHOT_DIR}/metadata.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "tag": "${TAG_NAME}",
  "description": "${DESCRIPTION}",
  "commit": "$(git rev-parse HEAD)",
  "commit_message": "$(git log --oneline -1)"
}
EOF
echo "✅ 메타데이터 저장"

echo ""
echo "========================================="
echo "📌 승인 스냅샷 생성 완료!"
echo "   태그: ${TAG_NAME}"
echo "   경로: ${SNAPSHOT_DIR}/"
echo "   복구: git checkout ${TAG_NAME}"
echo "========================================="
