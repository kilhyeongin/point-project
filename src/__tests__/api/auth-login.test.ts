import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { User } from "@/models/User";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
  getRateLimitInfo: vi.fn().mockResolvedValue({ limited: false, remaining: 5, resetAt: Date.now() + 120000 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
// setSessionCookie는 Next.js cookies API를 사용하므로 mock
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, setSessionCookie: vi.fn().mockResolvedValue(undefined) };
});

describe("POST /api/auth/login", () => {
  let passwordHash: string;

  beforeAll(async () => {
    await setupDB();
    passwordHash = await bcrypt.hash("Password1!", 10);
  });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();
  });

  function makeRequest(body: object) {
    return new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("username/password 없으면 400", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 유저는 401", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ username: "nobody", password: "Password1!" }));
    expect(res.status).toBe(401);
  });

  it("비밀번호 틀리면 401", async () => {
    await User.create({ username: "partner1", name: "파트너", email: "p@test.com", passwordHash, role: "PARTNER", status: "ACTIVE", organizationId: "4nwn" });
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ username: "partner1", password: "WrongPass1!" }));
    expect(res.status).toBe(401);
  });

  it("PENDING 파트너는 403", async () => {
    await User.create({ username: "pending1", name: "대기파트너", email: "pe@test.com", passwordHash, role: "PARTNER", status: "PENDING", organizationId: "4nwn" });
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ username: "pending1", password: "Password1!" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toMatch(/승인/);
  });

  it("BLOCKED 유저는 403", async () => {
    await User.create({ username: "blocked1", name: "차단유저", email: "bl@test.com", passwordHash, role: "CUSTOMER", status: "BLOCKED", organizationId: "4nwn" });
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ username: "blocked1", password: "Password1!" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toMatch(/차단/);
  });

  it("로그인 성공 시 200", async () => {
    await User.create({ username: "active1", name: "활성유저", email: "ac@test.com", passwordHash, role: "CUSTOMER", status: "ACTIVE", organizationId: "4nwn" });
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ username: "active1", password: "Password1!" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("username은 대소문자 무관하게 로그인된다", async () => {
    await User.create({ username: "activeuser", name: "활성유저", email: "au@test.com", passwordHash, role: "CUSTOMER", status: "ACTIVE", organizationId: "4nwn" });
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ username: "ACTIVEUSER", password: "Password1!" }));
    expect(res.status).toBe(200);
  });
});
