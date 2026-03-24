// src/lib/rateLimit.ts
// In-memory rate limiter (single-instance)
// 주의: 멀티 인스턴스(서버리스) 환경에서는 인스턴스별로 독립 동작합니다.
// 프로덕션에서 여러 인스턴스가 뜨는 경우 Upstash Redis 등으로 교체 권장.

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();
const MAX_STORE_SIZE = 10_000;

// 만료된 항목 정리 (1분마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60 * 1000);

/**
 * Returns true if the request should be BLOCKED (rate limit exceeded).
 * @param key      Unique key, e.g. `login:${ip}`
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // 스토어 크기 상한 초과 시 가장 오래된 항목 제거
    if (store.size >= MAX_STORE_SIZE && !store.has(key)) {
      const firstKey = store.keys().next().value;
      if (firstKey !== undefined) store.delete(firstKey);
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

/**
 * Rate limit 정보 조회 (읽기 전용 — count 변경 없음)
 * Retry-After 헤더 등에 사용
 */
export function getRateLimitInfo(
  key: string,
  limit: number,
  windowMs: number
): { limited: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    return { limited: false, remaining: limit, resetAt: now + windowMs };
  }

  const remaining = Math.max(0, limit - entry.count);
  return { limited: entry.count > limit, remaining, resetAt: entry.resetAt };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
