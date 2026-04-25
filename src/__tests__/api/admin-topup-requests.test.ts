import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { getWalletBalance } from "@/services/wallet";
import { User } from "@/models/User";
import { TopupRequest } from "@/models/TopupRequest";

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

describe("PATCH /api/admin/topup-requests/[id]/approve (충전 승인)", () => {
  let partnerId: mongoose.Types.ObjectId;
  let topupId: mongoose.Types.ObjectId;

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

    const doc = await TopupRequest.create({
      organizationId: "4nwn",
      accountId: partnerId,
      amount: 10000,
      status: "PENDING",
      requestedById: partnerId,
    });
    topupId = doc._id as mongoose.Types.ObjectId;
  });

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    const res = await PATCH({} as any, makeParams(topupId.toString()) as any);
    expect(res.status).toBe(401);
  });

  it("ADMIN이 아니면 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ ...adminSession, role: "PARTNER" } as any);
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    const res = await PATCH({} as any, makeParams(topupId.toString()) as any);
    expect(res.status).toBe(403);
  });

  it("잘못된 ID는 400", async () => {
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    const res = await PATCH({} as any, makeParams("invalid-id") as any);
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 ID는 400", async () => {
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    const res = await PATCH({} as any, makeParams(new mongoose.Types.ObjectId().toString()) as any);
    expect(res.status).toBe(400);
  });

  it("이미 APPROVED는 400", async () => {
    await TopupRequest.findByIdAndUpdate(topupId, { status: "APPROVED" });
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    const res = await PATCH({} as any, makeParams(topupId.toString()) as any);
    expect(res.status).toBe(400);
  });

  it("충전 승인 시 파트너 잔액 증가", async () => {
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    const res = await PATCH({} as any, makeParams(topupId.toString()) as any);
    expect(res.status).toBe(200);
    expect(await getWalletBalance(partnerId)).toBe(10000);
  });

  it("충전 승인 후 status가 APPROVED로 변경된다", async () => {
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    await PATCH({} as any, makeParams(topupId.toString()) as any);
    const updated = await TopupRequest.findById(topupId).lean() as any;
    expect(updated?.status).toBe("APPROVED");
  });

  it("응답에 id와 ledgerId가 포함된다", async () => {
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    const res = await PATCH({} as any, makeParams(topupId.toString()) as any);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.id).toBe("string");
    expect(typeof data.ledgerId).toBe("string");
  });

  it("동일한 요청 두 번 승인은 두 번째에서 400", async () => {
    const { PATCH } = await import("@/app/api/admin/topup-requests/[id]/approve/route");
    await PATCH({} as any, makeParams(topupId.toString()) as any);
    const res2 = await PATCH({} as any, makeParams(topupId.toString()) as any);
    expect(res2.status).toBe(400);
  });
});
