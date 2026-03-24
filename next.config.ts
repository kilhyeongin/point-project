import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Sentry 프로젝트 설정 (환경 변수로 관리)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // 소스맵을 Sentry에 업로드 (프로덕션 빌드 시)
  silent: true,

  // 번들 크기 분석 비활성화
  widenClientFileUpload: true,

  // 라우트 자동 계측
  automaticVercelMonitors: false,
});
