// sentry.client.config.ts
// 브라우저(클라이언트) 사이드 Sentry 초기화
// NEXT_PUBLIC_SENTRY_DSN 환경 변수에 DSN을 설정하세요.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 성능 트레이싱: 프로덕션에서는 0.1~0.2 권장
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // 세션 리플레이: 에러 발생 시 10%, 일반 세션 1%
  replaysOnErrorSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,

  // 개발 환경에서는 콘솔 출력 활성화
  debug: process.env.NODE_ENV === "development",

  integrations: [
    Sentry.replayIntegration(),
  ],
});
