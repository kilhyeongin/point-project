import { describe, it, expect, beforeEach, vi } from "vitest";

// isRateLimited 는 모듈-레벨 store에 상태가 누적되므로
// 각 테스트 전에 모듈을 재-import 해서 fresh 상태로 만든다.
describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  it("첫 요청은 차단하지 않는다", async () => {
    const { isRateLimited } = await import("@/lib/rateLimit");
    expect(await isRateLimited("test:a", 5, 60_000)).toBe(false);
  });

  it("limit 이하 요청은 허용한다", async () => {
    const { isRateLimited } = await import("@/lib/rateLimit");
    for (let i = 0; i < 5; i++) {
      expect(await isRateLimited("test:b", 5, 60_000)).toBe(false);
    }
  });

  it("limit 초과 요청은 차단한다", async () => {
    const { isRateLimited } = await import("@/lib/rateLimit");
    for (let i = 0; i < 5; i++) await isRateLimited("test:c", 5, 60_000);
    expect(await isRateLimited("test:c", 5, 60_000)).toBe(true);
  });

  it("윈도우가 지나면 리셋된다", async () => {
    const { isRateLimited } = await import("@/lib/rateLimit");
    for (let i = 0; i < 6; i++) await isRateLimited("test:d", 5, 60_000);
    expect(await isRateLimited("test:d", 5, 60_000)).toBe(true);

    vi.advanceTimersByTime(61_000);
    expect(await isRateLimited("test:d", 5, 60_000)).toBe(false);
  });

  it("getRateLimitInfo는 remaining을 올바르게 반환한다", async () => {
    const { isRateLimited, getRateLimitInfo } = await import("@/lib/rateLimit");
    await isRateLimited("test:e", 5, 60_000);
    await isRateLimited("test:e", 5, 60_000);
    const info = await getRateLimitInfo("test:e", 5, 60_000);
    expect(info.remaining).toBe(3);
    expect(info.limited).toBe(false);
  });

  it("getClientIp는 x-forwarded-for 첫 번째 IP를 반환한다", async () => {
    const { getClientIp } = await import("@/lib/rateLimit");
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("x-forwarded-for 없으면 'unknown'을 반환한다", async () => {
    const { getClientIp } = await import("@/lib/rateLimit");
    const req = new Request("http://localhost");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("x-real-ip 헤더를 fallback으로 사용한다", async () => {
    const { getClientIp } = await import("@/lib/rateLimit");
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });
});
