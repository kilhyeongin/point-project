import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { creditWallet, getWalletBalance } from "@/services/wallet";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));

import { getSessionFromCookies } from "@/lib/auth";

describe("POST /api/issue-requests (포인트 지급)", () => {
  let partnerId: mongoose.Types.ObjectId;
  let customerId: mongoose.Types.ObjectId;

  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();

    partnerId = new mongoose.Types.ObjectId();
    customerId = new mongoose.Types.ObjectId();

    // 파트너 유저 생성
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

    // 고객 유저 생성
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

    // 파트너-고객 신청 관계 생성
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
    return new Request("http://localhost/api/issue-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 1000 }));
    expect(res.status).toBe(401);
  });

  it("CUSTOMER 역할은 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ uid: customerId.toString(), role: "CUSTOMER", orgId: "4nwn", jti: "j", username: "c", name: "c" } as any);
    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 1000 }));
    expect(res.status).toBe(403);
  });

  it("userId 없으면 400", async () => {
    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ amount: 1000 }));
    expect(res.status).toBe(400);
  });

  it("amount 0 이하는 400", async () => {
    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 0 }));
    expect(res.status).toBe(400);
  });

  it("신청하지 않은 고객에게 지급 시 403", async () => {
    const stranger = new mongoose.Types.ObjectId();
    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ userId: stranger.toString(), amount: 1000 }));
    expect(res.status).toBe(403);
  });

  it("파트너 잔액 부족 시 400", async () => {
    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 1000 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/잔액 부족/);
  });

  it("지급 성공 시 파트너 잔액 감소, 고객 잔액 증가", async () => {
    await creditWallet(partnerId, 5000);

    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 2000, note: "테스트 지급" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.balanceBefore).toBe(5000);
    expect(data.balanceAfter).toBe(3000);

    // 고객 잔액 확인
    expect(await getWalletBalance(customerId)).toBe(2000);
    // 파트너 잔액 확인
    expect(await getWalletBalance(partnerId)).toBe(3000);
  });

  it("지급 성공 시 고객 정보가 응답에 포함된다", async () => {
    await creditWallet(partnerId, 5000);
    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 1000 }));
    const data = await res.json();
    expect(data.customer.username).toBe("customer1");
  });

  it("1,000,000P 초과 지급은 400", async () => {
    await creditWallet(partnerId, 2_000_000);
    const { POST } = await import("@/app/api/issue-requests/route");
    const res = await POST(makeRequest({ userId: customerId.toString(), amount: 1_000_001 }));
    expect(res.status).toBe(400);
  });
});
