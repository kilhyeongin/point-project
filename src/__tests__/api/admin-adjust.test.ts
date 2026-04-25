import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { getWalletBalance, creditWallet } from "@/services/wallet";
import { User } from "@/models/User";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));
vi.mock("@/models/AuditLog", () => ({ AuditLog: { create: vi.fn().mockResolvedValue({}) } }));

import { getSessionFromCookies } from "@/lib/auth";

const adminSession = {
  uid: new mongoose.Types.ObjectId().toString(),
  role: "ADMIN" as const,
  username: "admin1",
  name: "관리자",
  orgId: "4nwn",
  jti: "admin-jti",
};

function makeRequest(body: object) {
  return new Request("http://localhost/api/admin/adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/adjust", () => {
  let targetId: mongoose.Types.ObjectId;

  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();
    vi.mocked(getSessionFromCookies).mockResolvedValue(adminSession as any);

    targetId = new mongoose.Types.ObjectId();
    await User.create({
      _id: targetId,
      username: "partner1",
      name: "파트너",
      email: "p@test.com",
      passwordHash: "x",
      role: "PARTNER",
      status: "ACTIVE",
      organizationId: "4nwn",
    });
  });

  it("ADMIN이 아니면 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ ...adminSession, role: "PARTNER" } as any);
    const { POST } = await import("@/app/api/admin/adjust/route");
    const res = await POST(makeRequest({ targetUserId: targetId.toString(), amount: 1000, note: "테스트" }));
    expect(res.status).toBe(403);
  });

  it("amount가 0이면 400", async () => {
    const { POST } = await import("@/app/api/admin/adjust/route");
    const res = await POST(makeRequest({ targetUserId: targetId.toString(), amount: 0, note: "테스트" }));
    expect(res.status).toBe(400);
  });

  it("note 없으면 400", async () => {
    const { POST } = await import("@/app/api/admin/adjust/route");
    const res = await POST(makeRequest({ targetUserId: targetId.toString(), amount: 1000 }));
    expect(res.status).toBe(400);
  });

  it("잘못된 targetUserId는 400", async () => {
    const { POST } = await import("@/app/api/admin/adjust/route");
    const res = await POST(makeRequest({ targetUserId: "invalid-id", amount: 1000, note: "테스트" }));
    expect(res.status).toBe(400);
  });

  it("양수 조정 시 잔액이 증가한다", async () => {
    const { POST } = await import("@/app/api/admin/adjust/route");
    const res = await POST(makeRequest({ targetUserId: targetId.toString(), amount: 5000, note: "보너스" }));
    expect(res.status).toBe(200);
    expect(await getWalletBalance(targetId)).toBe(5000);
  });

  it("음수 조정 시 잔액이 감소한다", async () => {
    await creditWallet(targetId, 10000);
    const { POST } = await import("@/app/api/admin/adjust/route");
    const res = await POST(makeRequest({ targetUserId: targetId.toString(), amount: -3000, note: "차감" }));
    expect(res.status).toBe(200);
    expect(await getWalletBalance(targetId)).toBe(7000);
  });

  it("잔액 부족한 음수 조정은 400", async () => {
    await creditWallet(targetId, 100);
    const { POST } = await import("@/app/api/admin/adjust/route");
    const res = await POST(makeRequest({ targetUserId: targetId.toString(), amount: -500, note: "차감" }));
    expect(res.status).toBe(400);
  });
});
