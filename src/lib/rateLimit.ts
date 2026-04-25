// src/lib/rateLimit.ts
// Redis 우선 rate limiter (Upstash) — Redis 없으면 in-memory fallback
// Redis 사용 시: 멀티 인스턴스(서버리스) 환경에서도 정확히 동작
// Fallback 사용 시: 인스턴스별 독립 동작 (개발/테스트 환경 등)

import { getRedis } from "@/lib/redis";

// ── In-memory fallback ────────────────────────────────────────────
type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();
const MAX_STORE_SIZE = 10_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60 * 1000);

function isRateLimitedMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
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

// ── Redis rate limiter (fixed window) ────────────────────────────
async function isRateLimitedRedis(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const redisKey = `rl:${key}`;
  const windowSec = Math.ceil(windowMs / 1000);

  // INCR + EXPIRE (atomic via pipeline)
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSec);
  }
  return count > limit;
}

// ── 공개 API ─────────────────────────────────────────────────────

/**
 * Returns true if the request should be BLOCKED (rate limit exceeded).
 */
export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      return await isRateLimitedRedis(redis, key, limit, windowMs);
    } catch {
      // Redis 오류 시 in-memory fallback
    }
  }
  return isRateLimitedMemory(key, limit, windowMs);
}

/**
 * Rate limit 정보 조회 (Retry-After 헤더 등에 사용)
 * Redis 환경에서는 근사값 반환
 */
export async function getRateLimitInfo(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ limited: boolean; remaining: number; resetAt: number }> {
  const redis = getRedis();
  if (redis) {
    try {
      const redisKey = `rl:${key}`;
      const [count, ttl] = await Promise.all([
        redis.get<number>(redisKey),
        redis.ttl(redisKey),
      ]);
      const cnt = count ?? 0;
      const resetAt = ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + windowMs;
      return { limited: cnt > limit, remaining: Math.max(0, limit - cnt), resetAt };
    } catch {
      // fallback
    }
  }
  // in-memory
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    return { limited: false, remaining: limit, resetAt: now + windowMs };
  }
  return {
    limited: entry.count > limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export function getClientIp(req: Request): string {
  // x-forwarded-for는 "client, proxy1, proxy2" 순서 — 마지막 신뢰 프록시가 추가한 값을 사용
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    // 첫 번째 값이 실제 클라이언트 IP (Vercel/Nginx 등 역방향 프록시 표준)
    const ip = parts[0];
    if (ip && ip !== "unknown") return ip;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();
  return "unknown";
}
