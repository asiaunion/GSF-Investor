// sentry.server.config.ts
// C-1: Sentry 서버 사이드 에러 트래킹 설정 (API Routes, Server Components)
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",

    // 서버 트레이싱 (낮게 유지 — Vercel 무료 한도 고려)
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,

    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,

    // GitHub Actions 크론 실패 감지를 위한 태그
    initialScope: {
      tags: {
        service: "gsf-investor",
        runtime: "server",
      },
    },
  });
}
