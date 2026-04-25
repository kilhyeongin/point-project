import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { User } from "@/models/User";
import { PasswordResetToken } from "@/models/PasswordResetToken";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

describe("POST /api/auth/reset-password", () => {
  let userId: string;
  let validToken: string;

  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();

    const user = await User.create({
      username: "user1",
      name: "유저",
      email: "u@test.com",
      passwordHash: await bcrypt.hash("OldPass1!", 10),
      role: "CUSTOMER",
      status: "ACTIVE",
      organizationId: "4nwn",
    });
    userId = (user._id as any).toString();
    validToken = "valid-reset-token-abc123";

    await PasswordResetToken.create({
      userId: user._id,
      token: validToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });
  });

  function makeRequest(body: object) {
    return new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("token 없으면 400", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeRequest({ password: "NewPass1!" }) as any);
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 token은 400", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeRequest({ token: "no-such-token", password: "NewPass1!" }) as any);
    expect(res.status).toBe(400);
  });

  it("약한 비밀번호는 400", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeRequest({ token: validToken, password: "weak" }) as any);
    expect(res.status).toBe(400);
  });

  it("만료된 token은 400", async () => {
    await PasswordResetToken.create({
      userId,
      token: "expired-token",
      expiresAt: new Date(Date.now() - 1000),
      used: false,
    });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeRequest({ token: "expired-token", password: "NewPass1!" }) as any);
    expect(res.status).toBe(400);
  });

  it("비밀번호 재설정 성공 시 200 + 비밀번호 변경됨", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(makeRequest({ token: validToken, password: "NewPass1!" }) as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    const user = await User.findById(userId).lean() as any;
    expect(await bcrypt.compare("NewPass1!", user.passwordHash)).toBe(true);
  });

  it("성공 후 token이 used=true로 표시된다", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    await POST(makeRequest({ token: validToken, password: "NewPass1!" }) as any);
    const tokenDoc = await PasswordResetToken.findOne({ token: validToken }).lean() as any;
    expect(tokenDoc?.used).toBe(true);
  });

  it("이미 사용된 token은 400", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    await POST(makeRequest({ token: validToken, password: "NewPass1!" }) as any);
    const res2 = await POST(makeRequest({ token: validToken, password: "AnotherPass1!" }) as any);
    expect(res2.status).toBe(400);
  });
});
