import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// S3 이미지 호스트: {bucket}.s3.{region}.amazonaws.com
const s3ImageHost =
  process.env.AWS_S3_BUCKET && process.env.AWS_REGION
    ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`
    : "https://*.s3.amazonaws.com";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // X-XSS-Protection 제거 — 구식이며 최신 브라우저에서 비활성화됨. CSP가 대체
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' t1.daumcdn.net *.sentry.io",
      "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net",
      "font-src 'self' cdn.jsdelivr.net",
      `img-src 'self' data: blob: ${s3ImageHost}`,
      "connect-src 'self' *.sentry.io",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    // API 요청 body 크기 제한 (기본 4MB → 1MB로 축소)
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
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
