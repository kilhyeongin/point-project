// src/lib/env.ts
// Runtime environment variable validation

/**
 * Asserts that required env vars are set.
 * Throws in production if missing; warns in development.
 */
export function assertEnv(...keys: string[]): void {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length === 0) return;

  const msg = `필수 환경변수가 설정되지 않았습니다: ${missing.join(", ")}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`[ENV] ${msg}`);
  } else {
    console.warn(`[ENV] ⚠️  ${msg}`);
  }
}

/**
 * Returns an env var value, throwing if not set.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[ENV] 환경변수 ${key}가 설정되지 않았습니다.`);
  }
  return value;
}
