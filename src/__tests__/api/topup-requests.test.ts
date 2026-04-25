import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { User } from "@/models/User";
import { TopupRequest } from "@/models/TopupRequest";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));

import { getSessionFromCookies } from "@/lib/auth";

describe("POST /api/topup-requests (충전 요청 생성)", () => {
  let partnerId: mongoose.Types.ObjectId;

  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();

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

    vi.mocked(getSessionFromCookies).mockResolvedValue({
      uid: partnerId.toString(),
      role: "PARTNER",
      username: "partner1",
      name: "파트너",
      orgId: "4nwn",
      jti: "test-jti",
    } as any);
  });

  function makePostRequest(body: object) {
    return new Request("http://localhost/api/topup-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/topup-requests/route");
    const res = await POST(makePostRequest({ amount: 10000 }));
    expect(res.status).toBe(401);
  });

  it("CUSTOMER 역할은 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ uid: partnerId.toString(), role: "CUSTOMER", orgId: "4nwn", jti: "j", username: "c", name: "c" } as any);
    const { POST } = await import("@/app/api/topup-requests/route");
    const res = await POST(makePostRequest({ amount: 10000 }));
    expect(res.status).toBe(403);
  });

  it("amount 0 이하는 400", async () => {
    const { POST } = await import("@/app/api/topup-requests/route");
    const res = await POST(makePostRequest({ amount: 0 }));
    expect(res.status).toBe(400);
  });

  it("충전 요청 생성 성공", async () => {
    const { POST } = await import("@/app/api/topup-requests/route");
    const res = await POST(makePostRequest({ amount: 50000, note: "입금 완료" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.id).toBe("string");
    const doc = await TopupRequest.findById(data.id).lean() as any;
    expect(doc?.amount).toBe(50000);
    expect(doc?.status).toBe("PENDING");
  });
});

describe("DELETE /api/topup-requests/[id] (충전 요청 취소)", () => {
  let partnerId: mongoose.Types.ObjectId;
  let topupId: mongoose.Types.ObjectId;

  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();

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
      amount: 50000,
      status: "PENDING",
      requestedById: partnerId,
    });
    topupId = doc._id as mongoose.Types.ObjectId;

    vi.mocked(getSessionFromCookies).mockResolvedValue({
      uid: partnerId.toString(),
      role: "PARTNER",
      username: "partner1",
      name: "파트너",
      orgId: "4nwn",
      jti: "test-jti",
    } as any);
  });

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/topup-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(topupId.toString()) as any);
    expect(res.status).toBe(401);
  });

  it("CUSTOMER 역할은 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ uid: partnerId.toString(), role: "CUSTOMER", orgId: "4nwn", jti: "j", username: "c", name: "c" } as any);
    const { DELETE } = await import("@/app/api/topup-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(topupId.toString()) as any);
    expect(res.status).toBe(403);
  });

  it("잘못된 ID는 400", async () => {
    const { DELETE } = await import("@/app/api/topup-requests/[id]/route");
    const res = await DELETE({} as any, makeParams("invalid-id") as any);
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 ID는 404", async () => {
    const { DELETE } = await import("@/app/api/topup-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(new mongoose.Types.ObjectId().toString()) as any);
    expect(res.status).toBe(404);
  });

  it("이미 APPROVED 상태는 400", async () => {
    await TopupRequest.findByIdAndUpdate(topupId, { status: "APPROVED" });
    const { DELETE } = await import("@/app/api/topup-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(topupId.toString()) as any);
    expect(res.status).toBe(400);
  });

  it("PENDING 취소 성공 시 문서가 삭제된다", async () => {
    const { DELETE } = await import("@/app/api/topup-requests/[id]/route");
    const res = await DELETE({} as any, makeParams(topupId.toString()) as any);
    expect(res.status).toBe(200);
    expect(await TopupRequest.findById(topupId)).toBeNull();
  });
});
