import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { creditWallet, getWalletBalance } from "@/services/wallet";
import { User } from "@/models/User";
import { ShopProduct } from "@/models/ShopProduct";
import { ShopOrder } from "@/models/ShopOrder";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));
vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
  buildGiftCardSmsText: vi.fn().mockReturnValue("상품권 SMS"),
}));

import { getSessionFromCookies } from "@/lib/auth";

describe("POST /api/customer/shop/order (상품 구매)", () => {
  let customerId: mongoose.Types.ObjectId;
  let productId: mongoose.Types.ObjectId;

  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();

    customerId = new mongoose.Types.ObjectId();
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

    const product = await ShopProduct.create({
      organizationId: "4nwn",
      name: "스타벅스 아메리카노",
      brand: "스타벅스",
      pointCost: 5000,
      isActive: true,
    });
    productId = product._id as mongoose.Types.ObjectId;

    vi.mocked(getSessionFromCookies).mockResolvedValue({
      uid: customerId.toString(),
      role: "CUSTOMER",
      username: "customer1",
      name: "고객",
      orgId: "4nwn",
      jti: "test-jti",
    } as any);
  });

  function makeRequest(body: object) {
    return new Request("http://localhost/api/customer/shop/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ productId: productId.toString(), idempotencyKey: "key-001" }) as any);
    expect(res.status).toBe(401);
  });

  it("PARTNER 역할은 403", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue({ uid: customerId.toString(), role: "PARTNER", orgId: "4nwn", jti: "j", username: "p", name: "p" } as any);
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ productId: productId.toString(), idempotencyKey: "key-002" }) as any);
    expect(res.status).toBe(403);
  });

  it("productId 없으면 400", async () => {
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ idempotencyKey: "key-003" }) as any);
    expect(res.status).toBe(400);
  });

  it("idempotencyKey 없으면 400", async () => {
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ productId: productId.toString() }) as any);
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 상품은 404", async () => {
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ productId: new mongoose.Types.ObjectId().toString(), idempotencyKey: "key-004-valid" }) as any);
    expect(res.status).toBe(404);
  });

  it("잔액 부족 시 400", async () => {
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ productId: productId.toString(), idempotencyKey: "key-005-valid" }) as any);
    expect(res.status).toBe(400);
  });

  it("구매 성공 시 고객 잔액 감소 + pinNumber 반환", async () => {
    await creditWallet(customerId, 10000);
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ productId: productId.toString(), idempotencyKey: "key-006-valid-key" }) as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.pinNumber).toBe("string");
    expect(data.pinNumber.length).toBeGreaterThan(0);
    expect(await getWalletBalance(customerId)).toBe(5000);
  });

  it("구매 성공 후 주문이 COMPLETED 상태로 저장된다", async () => {
    await creditWallet(customerId, 10000);
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ productId: productId.toString(), idempotencyKey: "key-007-valid-key" }) as any);
    const data = await res.json();
    const order = await ShopOrder.findById(data.orderId).lean() as any;
    expect(order?.status).toBe("COMPLETED");
  });

  it("같은 idempotencyKey 재요청은 200 + alreadyProcessed: true", async () => {
    await creditWallet(customerId, 10000);
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const key = "key-008-idempotent-long";
    await POST(makeRequest({ productId: productId.toString(), idempotencyKey: key }) as any);
    const res2 = await POST(makeRequest({ productId: productId.toString(), idempotencyKey: key }) as any);
    expect(res2.status).toBe(200);
    const data = await res2.json();
    expect(data.alreadyProcessed).toBe(true);
    // 잔액은 한 번만 차감되어야 함
    expect(await getWalletBalance(customerId)).toBe(5000);
  });

  it("비활성 상품은 404", async () => {
    await ShopProduct.findByIdAndUpdate(productId, { isActive: false });
    await creditWallet(customerId, 10000);
    const { POST } = await import("@/app/api/customer/shop/order/route");
    const res = await POST(makeRequest({ productId: productId.toString(), idempotencyKey: "key-009-valid-key" }) as any);
    expect(res.status).toBe(404);
  });
});
