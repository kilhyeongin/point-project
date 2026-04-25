import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { creditWallet, getWalletBalance } from "@/services/wallet";
import { User } from "@/models/User";
import { WithdrawalRequest } from "@/models/WithdrawalRequest";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));

import { getSessionFromCookies } from "@/lib/auth";

const adminSession = {
  uid: new mongoose.Types.ObjectId().toString(),
  role: "ADMIN" as const,
  username: "admin1",
  name: "관리자",
  orgId: "4nwn",
  jti: "admin-jti",
};

function makeRequest(body?: object) {
  return new Request("http://localhost/api/admin/withdrawal-requests/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/withdrawal-requests/[id] (출금 확정)", () => {
  let partnerId: mongoose.Types.ObjectId;
  let withdrawalId: mongoose.Types.ObjectId;

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

    const doc = await WithdrawalRequest.create({
      organizationId: "4nwn",
      partnerId,
      partnerName: "파트너",
      amount: 2000,
      status: "PENDING",
    });
    withdrawalId = doc._id as mongoose.Types.ObjectId;
  });

  it("ADMIN이 아니면 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ ...adminSession, role: "PARTNER" } as any);
    const { PATCH } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await PATCH(makeRequest(), makeParams(withdrawalId.toString()) as any);
    expect(res.status).toBe(403);
  });

  it("잘못된 ID는 400", async () => {
    const { PATCH } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await PATCH(makeRequest(), makeParams("invalid-id") as any);
    expect(res.status).toBe(400);
  });

  it("파트너 잔액 부족 시 400", async () => {
    const { PATCH } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await PATCH(makeRequest(), makeParams(withdrawalId.toString()) as any);
    expect(res.status).toBe(400);
  });

  it("이미 CONFIRMED 상태는 400", async () => {
    await creditWallet(partnerId, 5000);
    await WithdrawalRequest.findByIdAndUpdate(withdrawalId, { status: "CONFIRMED" });
    const { PATCH } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await PATCH(makeRequest(), makeParams(withdrawalId.toString()) as any);
    expect(res.status).toBe(400);
  });

  it("출금 확정 시 파트너 잔액 차감", async () => {
    await creditWallet(partnerId, 5000);
    const { PATCH } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await PATCH(makeRequest({ adminNote: "확인 완료" }), makeParams(withdrawalId.toString()) as any);
    expect(res.status).toBe(200);
    expect(await getWalletBalance(partnerId)).toBe(3000);
  });

  it("출금 확정 후 status가 CONFIRMED로 변경된다", async () => {
    await creditWallet(partnerId, 5000);
    const { PATCH } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    await PATCH(makeRequest(), makeParams(withdrawalId.toString()) as any);
    const updated = await WithdrawalRequest.findById(withdrawalId).lean() as any;
    expect(updated?.status).toBe("CONFIRMED");
  });
});

describe("DELETE /api/admin/withdrawal-requests/[id] (출금 거절)", () => {
  let partnerId: mongoose.Types.ObjectId;
  let withdrawalId: mongoose.Types.ObjectId;

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

    const doc = await WithdrawalRequest.create({
      organizationId: "4nwn",
      partnerId,
      partnerName: "파트너",
      amount: 2000,
      status: "PENDING",
    });
    withdrawalId = doc._id as mongoose.Types.ObjectId;
  });

  it("ADMIN이 아니면 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ ...adminSession, role: "PARTNER" } as any);
    const { DELETE } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(withdrawalId.toString()) as any);
    expect(res.status).toBe(403);
  });

  it("존재하지 않는 ID는 404", async () => {
    const { DELETE } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(new mongoose.Types.ObjectId().toString()) as any);
    expect(res.status).toBe(404);
  });

  it("이미 CONFIRMED는 400", async () => {
    await WithdrawalRequest.findByIdAndUpdate(withdrawalId, { status: "CONFIRMED" });
    const { DELETE } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(withdrawalId.toString()) as any);
    expect(res.status).toBe(400);
  });

  it("PENDING 거절 시 200 + status CANCELLED", async () => {
    const { DELETE } = await import("@/app/api/admin/withdrawal-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(withdrawalId.toString()) as any);
    expect(res.status).toBe(200);
    const updated = await WithdrawalRequest.findById(withdrawalId).lean() as any;
    expect(updated?.status).toBe("CANCELLED");
  });
});
