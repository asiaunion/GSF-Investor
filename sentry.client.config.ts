// sentry.client.config.ts
// C-1: Sentry 클라이언트 사이드 에러 트래킹 설정
// NEXT_PUBLIC_SENTRY_DSN 환경변수가 없으면 비활성화 (로컬 개발 안전)
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",

    // 성능 트레이싱 (프로덕션 5%, 개발 0%)
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,

    // 릴리즈 태깅 (Vercel 자동 주입)
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    // 개인정보 보호: 이메일/IP 수집 비활성화
    sendDefaultPii: false,

    // 무시할 에러 (네트워크 일시 오류 등)
    ignoreErrors: [
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      "ResizeObserver loop limit exceeded",
    ],

    // 디버그 모드 (개발 시에만)
    debug: process.env.NODE_ENV === "development",
  });
}
