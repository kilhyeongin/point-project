import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { creditWallet, getWalletBalance } from "@/services/wallet";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { getSessionFromCookies } from "@/lib/auth";

describe("POST /api/partner/use-direct (즉시 포인트 차감)", () => {
  let partnerId: mongoose.Types.ObjectId;
  let customerId: mongoose.Types.ObjectId;

  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();

    partnerId = new mongoose.Types.ObjectId();
    customerId = new mongoose.Types.ObjectId();

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
    await User.create({
      _id: customerId,
      username: "customer1",
      name: "고객",
      email: "c@test.com",
      passwordHash: "x",
      role: "CUSTOMER",
      status: "ACTIVE",
      organizationId: "4nwn",
    });
    await FavoritePartner.create({
      organizationId: "4nwn",
      customerId,
      partnerId,
      status: "APPLIED",
    });

    vi.mocked(getSessionFromCookies).mockResolvedValue({
      uid: partnerId.toString(),
      role: "PARTNER",
      username: "partner1",
      name: "파트너",
      orgId: "4nwn",
      jti: "test-jti",
    } as any);
  });

  function makeRequest(body: object) {
    return new Request("http://localhost/api/partner/use-direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 500 }));
    expect(res.status).toBe(401);
  });

  it("CUSTOMER 역할은 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ uid: customerId.toString(), role: "CUSTOMER", orgId: "4nwn", jti: "j", username: "c", name: "c" } as any);
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 500 }));
    expect(res.status).toBe(403);
  });

  it("userId 없으면 400", async () => {
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ amount: 500 }));
    expect(res.status).toBe(400);
  });

  it("amount 0 이하는 400", async () => {
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 0 }));
    expect(res.status).toBe(400);
  });

  it("amount 소수점은 400", async () => {
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 50.5 }));
    expect(res.status).toBe(400);
  });

  it("1,000,000P 초과는 400", async () => {
    await creditWallet(customerId, 2_000_000);
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 1_000_001 }));
    expect(res.status).toBe(400);
  });

  it("APPLIED 아닌 고객은 403", async () => {
    const stranger = await User.create({
      username: "stranger",
      name: "낯선이",
      email: "s@test.com",
      passwordHash: "x",
      role: "CUSTOMER",
      status: "ACTIVE",
      organizationId: "4nwn",
    });
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: (stranger._id as any).toString(), amount: 500 }));
    expect(res.status).toBe(403);
  });

  it("고객 잔액 부족 시 400", async () => {
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 500 }));
    expect(res.status).toBe(400);
  });

  it("성공 시 고객 잔액 감소, 파트너 잔액 증가", async () => {
    await creditWallet(customerId, 3000);
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 1000, note: "테스트" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.balanceBefore).toBe(3000);
    expect(data.balanceAfter).toBe(2000);
    expect(await getWalletBalance(customerId)).toBe(2000);
    expect(await getWalletBalance(partnerId)).toBe(1000);
  });

  it("응답에 고객 정보가 포함된다", async () => {
    await creditWallet(customerId, 1000);
    const { POST } = await import("@/app/api/partner/use-direct/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 500 }));
    const data = await res.json();
    expect(data.customer.username).toBe("customer1");
  });
});
