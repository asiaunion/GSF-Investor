import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// C-1: Sentry 플러그인 래핑
// SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN 환경변수가 없으면 Sentry 비활성화
const hasSentryDsn =
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

export default hasSentryDsn
  ? withSentryConfig(nextConfig, {
      // Sentry 조직/프로젝트 슬러그 (Vercel 환경변수로 주입)
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // 소스맵 설정
      sourcemaps: {
        disable: false, // Sentry에 소스맵 업로드 활성화
      },

      // 빌드 로그 최소화
      silent: !process.env.CI,

      // Vercel Edge Runtime 호환성
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",

      // 자동 계측 — Route Handler + Server Action
      automaticVercelMonitors: true,
    })
  : nextConfig;
