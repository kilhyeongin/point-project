// sentry.server.config.ts
// 서버(Node.js) 사이드 Sentry 초기화
// SENTRY_DSN 환경 변수에 DSN을 설정하세요.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  debug: process.env.NODE_ENV === "development",
});
