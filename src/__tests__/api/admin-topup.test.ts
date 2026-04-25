import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { getWalletBalance } from "@/services/wallet";
import { User } from "@/models/User";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));
vi.mock("@/models/AuditLog", () => ({ AuditLog: { create: vi.fn().mockResolvedValue({}) } }));
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { getSessionFromCookies } from "@/lib/auth";

const adminSession = {
  uid: new mongoose.Types.ObjectId().toString(),
  role: "ADMIN" as const,
  username: "admin1",
  name: "관리자",
  orgId: "4nwn",
  jti: "admin-jti",
};

describe("POST /api/admin/topup (관리자 수동 충전)", () => {
  let partnerId: mongoose.Types.ObjectId;

  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();
    vi.mocked(getSessionFromCookies).mockResolvedValue(adminSession as any);

    partnerId = new mongoose.Types.ObjectId();
    await User.create({
      _id: partnerId,
      username: "partner1",
      name: "파트너",
      email: "p@test.com",
      passwordHash: "x",
      role: "PARTNER",
      status: "ACTIVE",
      organizationId: "4nwn",
    });
  });

  function makeRequest(body: object) {
    return new Request("http://localhost/api/admin/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify(body),
    });
  }

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/topup/route");
    const res = await POST(makeRequest({ targetUserId: partnerId.toString(), amount: 5000 }));
    expect(res.status).toBe(401);
  });

  it("ADMIN이 아니면 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ ...adminSession, role: "PARTNER" } as any);
    const { POST } = await import("@/app/api/admin/topup/route");
    const res = await POST(makeRequest({ targetUserId: partnerId.toString(), amount: 5000 }));
    expect(res.status).toBe(403);
  });

  it("잘못된 targetUserId는 400", async () => {
    const { POST } = await import("@/app/api/admin/topup/route");
    const res = await POST(makeRequest({ targetUserId: "invalid", amount: 5000 }));
    expect(res.status).toBe(400);
  });

  it("amount 0 이하는 400", async () => {
    const { POST } = await import("@/app/api/admin/topup/route");
    const res = await POST(makeRequest({ targetUserId: partnerId.toString(), amount: 0 }));
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 유저는 404", async () => {
    const { POST } = await import("@/app/api/admin/topup/route");
    const res = await POST(makeRequest({ targetUserId: new mongoose.Types.ObjectId().toString(), amount: 5000 }));
    expect(res.status).toBe(404);
  });

  it("CUSTOMER 타겟은 400 (PARTNER만 충전 가능)", async () => {
    const customerId = new mongoose.Types.ObjectId();
    await User.create({
      _id: customerId,
      username: "cust1",
      name: "고객",
      email: "cu@test.com",
      passwordHash: "x",
      role: "CUSTOMER",
      status: "ACTIVE",
      organizationId: "4nwn",
    });
    const { POST } = await import("@/app/api/admin/topup/route");
    const res = await POST(makeRequest({ targetUserId: customerId.toString(), amount: 5000 }));
    expect(res.status).toBe(400);
  });

  it("충전 성공 시 파트너 잔액 증가", async () => {
    const { POST } = await import("@/app/api/admin/topup/route");
    const res = await POST(makeRequest({ targetUserId: partnerId.toString(), amount: 10000, note: "보너스" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.amount).toBe(10000);
    expect(await getWalletBalance(partnerId)).toBe(10000);
  });

  it("응답에 대상 유저 정보와 ledgerId가 포함된다", async () => {
    const { POST } = await import("@/app/api/admin/topup/route");
    const res = await POST(makeRequest({ targetUserId: partnerId.toString(), amount: 5000 }));
    const data = await res.json();
    expect(data.target.username).toBe("partner1");
    expect(typeof data.ledgerId).toBe("string");
  });
});
