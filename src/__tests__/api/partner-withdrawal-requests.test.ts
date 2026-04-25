import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupDB, teardownDB, clearDB } from "../setup/db";
import { creditWallet } from "@/services/wallet";

vi.mock("@/lib/db", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => null }));

import { getSessionFromCookies } from "@/lib/auth";

const mockSession = (overrides = {}) => ({
  uid: new mongoose.Types.ObjectId().toString(),
  role: "PARTNER" as const,
  username: "partner1",
  name: "테스트파트너",
  orgId: "4nwn",
  jti: "test-jti",
  ...overrides,
});

function makeRequest(body: object) {
  return new Request("http://localhost/api/partner/withdrawal-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/partner/withdrawal-requests", () => {
  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();
  });

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/partner/withdrawal-requests/route");
    const res = await POST(makeRequest({ amount: 500000 }));
    expect(res.status).toBe(401);
  });

  it("CUSTOMER 역할은 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(mockSession({ role: "CUSTOMER" }) as any);
    const { POST } = await import("@/app/api/partner/withdrawal-requests/route");
    const res = await POST(makeRequest({ amount: 500000 }));
    expect(res.status).toBe(401);
  });

  it("최소 금액(500,000P) 미달이면 400", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(mockSession() as any);
    const { POST } = await import("@/app/api/partner/withdrawal-requests/route");
    const res = await POST(makeRequest({ amount: 100000 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("50,000P 단위 아니면 400", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(mockSession() as any);
    const { POST } = await import("@/app/api/partner/withdrawal-requests/route");
    const res = await POST(makeRequest({ amount: 510000 }));
    expect(res.status).toBe(400);
  });

  it("잔액 부족이면 400", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(mockSession() as any);
    const { POST } = await import("@/app/api/partner/withdrawal-requests/route");
    const res = await POST(makeRequest({ amount: 500000 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/가용 포인트/);
  });

  it("잔액 충분하면 201 + id 반환", async () => {
    const session = mockSession();
    vi.mocked(getSessionFromCookies).mockResolvedValue(session as any);

    // 잔액 충전
    await creditWallet(new mongoose.Types.ObjectId(session.uid), 1_000_000);

    const { POST } = await import("@/app/api/partner/withdrawal-requests/route");
    const res = await POST(makeRequest({ amount: 500000 }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.id).toBe("string");
  });

  it("PENDING 출금이 있으면 두 번째 신청은 400", async () => {
    const session = mockSession();
    vi.mocked(getSessionFromCookies).mockResolvedValue(session as any);
    await creditWallet(new mongoose.Types.ObjectId(session.uid), 2_000_000);

    const { POST } = await import("@/app/api/partner/withdrawal-requests/route");
    await POST(makeRequest({ amount: 500000 }));
    const res = await POST(makeRequest({ amount: 500000 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/대기중/);
  });
});
