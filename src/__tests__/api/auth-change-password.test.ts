import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { User } from "@/models/User";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));

import { getSessionFromCookies } from "@/lib/auth";

describe("POST /api/auth/change-password", () => {
  let userId: string;
  let passwordHash: string;

  beforeAll(async () => {
    await setupDB();
    passwordHash = await bcrypt.hash("OldPass1!", 10);
  });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();

    const user = await User.create({
      username: "user1",
      name: "유저",
      email: "u@test.com",
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      organizationId: "4nwn",
    });
    userId = (user._id as any).toString();

    vi.mocked(getSessionFromCookies).mockResolvedValue({
      uid: userId,
      role: "CUSTOMER",
      username: "user1",
      name: "유저",
      orgId: "4nwn",
      jti: "test-jti",
    } as any);
  });

  function makeRequest(body: object) {
    return new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(makeRequest({ currentPassword: "OldPass1!", newPassword: "NewPass1!", confirmPassword: "NewPass1!" }) as any);
    expect(res.status).toBe(401);
  });

  it("현재 비밀번호 없으면 400", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(makeRequest({ newPassword: "NewPass1!", confirmPassword: "NewPass1!" }) as any);
    expect(res.status).toBe(400);
  });

  it("약한 새 비밀번호는 400", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(makeRequest({ currentPassword: "OldPass1!", newPassword: "weak", confirmPassword: "weak" }) as any);
    expect(res.status).toBe(400);
  });

  it("새 비밀번호 불일치는 400", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(makeRequest({ currentPassword: "OldPass1!", newPassword: "NewPass1!", confirmPassword: "NewPass2!" }) as any);
    expect(res.status).toBe(400);
  });

  it("현재 비밀번호 = 새 비밀번호는 400", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(makeRequest({ currentPassword: "OldPass1!", newPassword: "OldPass1!", confirmPassword: "OldPass1!" }) as any);
    expect(res.status).toBe(400);
  });

  it("현재 비밀번호 틀리면 400", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(makeRequest({ currentPassword: "WrongPass1!", newPassword: "NewPass1!", confirmPassword: "NewPass1!" }) as any);
    expect(res.status).toBe(400);
  });

  it("비밀번호 변경 성공", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(makeRequest({ currentPassword: "OldPass1!", newPassword: "NewPass1!", confirmPassword: "NewPass1!" }) as any);
    expect(res.status).toBe(200);
    // 새 비밀번호로 로그인 가능한지 확인
    const user = await User.findById(userId).lean() as any;
    expect(await bcrypt.compare("NewPass1!", user.passwordHash)).toBe(true);
  });
});
