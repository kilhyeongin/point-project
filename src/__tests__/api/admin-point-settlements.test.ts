import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { creditWallet, getWalletBalance } from "@/services/wallet";
import { User } from "@/models/User";
import { PointSettlementPayment } from "@/models/PointSettlementPayment";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));

import { getSessionFromCookies } from "@/lib/auth";

const adminId = new mongoose.Types.ObjectId();
const adminSession = {
  uid: adminId.toString(),
  role: "ADMIN" as const,
  username: "admin1",
  name: "관리자",
  orgId: "4nwn",
  jti: "admin-jti",
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/point-settlements/[id] (정산 확정)", () => {
  let partnerId: mongoose.Types.ObjectId;
  let settlementId: mongoose.Types.ObjectId;

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
    await User.create({
      _id: adminId,
      username: "admin1",
      name: "관리자",
      email: "a@test.com",
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: "4nwn",
    });

    const doc = await PointSettlementPayment.create({
      organizationId: "4nwn",
      partnerId,
      partnerName: "파트너",
      year: 2025,
      month: 4,
      amount: 3000,
      status: "PENDING",
    });
    settlementId = doc._id as mongoose.Types.ObjectId;
  });

  it("ADMIN이 아니면 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ ...adminSession, role: "PARTNER" } as any);
    const { PATCH } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await PATCH({} as any, makeParams(settlementId.toString()) as any);
    expect(res.status).toBe(403);
  });

  it("잘못된 ID는 400", async () => {
    const { PATCH } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await PATCH({} as any, makeParams("not-valid-id") as any);
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 ID는 400", async () => {
    const { PATCH } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await PATCH({} as any, makeParams(new mongoose.Types.ObjectId().toString()) as any);
    expect(res.status).toBe(400);
  });

  it("이미 CONFIRMED는 400", async () => {
    await PointSettlementPayment.findByIdAndUpdate(settlementId, { status: "CONFIRMED" });
    const { PATCH } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await PATCH({} as any, makeParams(settlementId.toString()) as any);
    expect(res.status).toBe(400);
  });

  it("잔액 부족한 파트너는 400", async () => {
    const { PATCH } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await PATCH({} as any, makeParams(settlementId.toString()) as any);
    expect(res.status).toBe(400);
  });

  it("정산 확정 시 파트너 잔액 감소, 관리자 잔액 증가", async () => {
    await creditWallet(partnerId, 5000);
    const { PATCH } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await PATCH({} as any, makeParams(settlementId.toString()) as any);
    expect(res.status).toBe(200);
    expect(await getWalletBalance(partnerId)).toBe(2000);
    expect(await getWalletBalance(adminId)).toBe(3000);
  });

  it("확정 후 status가 CONFIRMED로 변경된다", async () => {
    await creditWallet(partnerId, 5000);
    const { PATCH } = await import("@/app/api/admin/point-settlements/[id]/route");
    await PATCH({} as any, makeParams(settlementId.toString()) as any);
    const updated = await PointSettlementPayment.findById(settlementId).lean() as any;
    expect(updated?.status).toBe("CONFIRMED");
  });
});

describe("DELETE /api/admin/point-settlements/[id] (정산 거절)", () => {
  let partnerId: mongoose.Types.ObjectId;
  let settlementId: mongoose.Types.ObjectId;

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

    const doc = await PointSettlementPayment.create({
      organizationId: "4nwn",
      partnerId,
      partnerName: "파트너",
      year: 2025,
      month: 4,
      amount: 3000,
      status: "PENDING",
    });
    settlementId = doc._id as mongoose.Types.ObjectId;
  });

  it("ADMIN이 아니면 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ ...adminSession, role: "PARTNER" } as any);
    const { DELETE } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await DELETE({} as any, makeParams(settlementId.toString()) as any);
    expect(res.status).toBe(403);
  });

  it("존재하지 않는 ID는 404", async () => {
    const { DELETE } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await DELETE({} as any, makeParams(new mongoose.Types.ObjectId().toString()) as any);
    expect(res.status).toBe(404);
  });

  it("이미 CONFIRMED는 400", async () => {
    await PointSettlementPayment.findByIdAndUpdate(settlementId, { status: "CONFIRMED" });
    const { DELETE } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await DELETE({} as any, makeParams(settlementId.toString()) as any);
    expect(res.status).toBe(400);
  });

  it("PENDING 거절 시 200 + status CANCELLED", async () => {
    const { DELETE } = await import("@/app/api/admin/point-settlements/[id]/route");
    const res = await DELETE({} as any, makeParams(settlementId.toString()) as any);
    expect(res.status).toBe(200);
    const updated = await PointSettlementPayment.findById(settlementId).lean() as any;
    expect(updated?.status).toBe("CANCELLED");
  });
});
