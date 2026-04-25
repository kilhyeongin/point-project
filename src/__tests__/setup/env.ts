// 테스트 환경 변수 설정 — vitest setupFiles에서 가장 먼저 실행됨
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!!";
process.env.QR_SECRET = "test-qr-secret-at-least-32-chars-long!!";
process.env.NODE_ENV = "test";
