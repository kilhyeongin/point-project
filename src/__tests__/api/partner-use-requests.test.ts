import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
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

describe("POST /api/partner/use-requests (포인트 차감)", () => {
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
    return new Request("http://localhost/api/partner/use-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function makeQrToken(subjectId: string) {
    return jwt.sign(
      { typ: "customer_qr" },
      process.env.QR_SECRET!,
      { subject: subjectId, expiresIn: "3m", issuer: "point-platform", audience: "partner-scan", jwtid: randomUUID() }
    );
  }

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ toUsername: "customer1", amount: 500 }));
    expect(res.status).toBe(401);
  });

  it("CUSTOMER 역할은 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ uid: customerId.toString(), role: "CUSTOMER", orgId: "4nwn", jti: "j", username: "c", name: "c" } as any);
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ toUsername: "customer1", amount: 500 }));
    expect(res.status).toBe(403);
  });

  it("amount 0 이하는 400", async () => {
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ toUsername: "customer1", amount: 0 }));
    expect(res.status).toBe(400);
  });

  it("amount 소수점은 400", async () => {
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ toUsername: "customer1", amount: 100.5 }));
    expect(res.status).toBe(400);
  });

  it("toUsername/qrToken 둘 다 없으면 400", async () => {
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ amount: 500 }));
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 username은 404", async () => {
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ toUsername: "nobody", amount: 500 }));
    expect(res.status).toBe(404);
  });

  it("APPLIED 아닌 고객에게는 403", async () => {
    const stranger = await User.create({
      username: "stranger",
      name: "낯선이",
      email: "s@test.com",
      passwordHash: "x",
      role: "CUSTOMER",
      status: "ACTIVE",
      organizationId: "4nwn",
    });
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ toUsername: "stranger", amount: 500 }));
    expect(res.status).toBe(403);
  });

  it("username 방식 성공 → PENDING (즉시 차감 없음)", async () => {
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ toUsername: "customer1", amount: 500 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.instant).toBe(false);
    expect(data.request.status).toBe("PENDING");
  });

  it("QR 방식 성공 → APPROVED + 고객 잔액 감소 + 파트너 잔액 증가", async () => {
    await creditWallet(customerId, 3000);
    const qrToken = makeQrToken(customerId.toString());
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ qrToken, amount: 1000 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.instant).toBe(true);
    expect(data.request.status).toBe("APPROVED");
    expect(data.balanceBefore).toBe(3000);
    expect(data.balanceAfter).toBe(2000);
    expect(await getWalletBalance(customerId)).toBe(2000);
    expect(await getWalletBalance(partnerId)).toBe(1000);
  });

  it("QR 방식 고객 잔액 부족 시 400", async () => {
    const qrToken = makeQrToken(customerId.toString());
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ qrToken, amount: 999 }));
    expect(res.status).toBe(400);
  });

  it("만료된 QR는 400", async () => {
    const expiredToken = jwt.sign(
      { typ: "customer_qr" },
      process.env.QR_SECRET!,
      { subject: customerId.toString(), expiresIn: "0s", issuer: "point-platform", audience: "partner-scan", jwtid: randomUUID() }
    );
    await new Promise(r => setTimeout(r, 10));
    const { POST } = await import("@/app/api/partner/use-requests/route");
    const res = await POST(makeRequest({ qrToken: expiredToken, amount: 500 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/만료/);
  });
});
