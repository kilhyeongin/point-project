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
  return new Request("http://localhost/api/partner/point-settlements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/partner/point-settlements", () => {
  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();
  });

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { POST } = await import("@/app/api/partner/point-settlements/route");
    const res = await POST(makeRequest({ amount: 10000, year: 2025, month: 1 }));
    expect(res.status).toBe(401);
  });

  it("amount 없으면 400", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(mockSession() as any);
    const { POST } = await import("@/app/api/partner/point-settlements/route");
    const res = await POST(makeRequest({ year: 2025, month: 1 }));
    expect(res.status).toBe(400);
  });

  it("year/month 없으면 400", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(mockSession() as any);
    const { POST } = await import("@/app/api/partner/point-settlements/route");
    const res = await POST(makeRequest({ amount: 10000 }));
    expect(res.status).toBe(400);
  });

  it("잔액 부족이면 400", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(mockSession() as any);
    const { POST } = await import("@/app/api/partner/point-settlements/route");
    const res = await POST(makeRequest({ amount: 10000, year: 2025, month: 1 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/가용 포인트/);
  });

  it("잔액 충분하면 201", async () => {
    const session = mockSession();
    vi.mocked(getSessionFromCookies).mockResolvedValue(session as any);
    await creditWallet(new mongoose.Types.ObjectId(session.uid), 50000);

    const { POST } = await import("@/app/api/partner/point-settlements/route");
    const res = await POST(makeRequest({ amount: 10000, year: 2025, month: 1 }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.id).toBe("string");
  });

  it("PENDING 정산이 있으면 두 번째 신청은 400", async () => {
    const session = mockSession();
    vi.mocked(getSessionFromCookies).mockResolvedValue(session as any);
    await creditWallet(new mongoose.Types.ObjectId(session.uid), 100000);

    const { POST } = await import("@/app/api/partner/point-settlements/route");
    await POST(makeRequest({ amount: 10000, year: 2025, month: 1 }));
    const res = await POST(makeRequest({ amount: 10000, year: 2025, month: 2 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/대기중/);
  });
});

describe("GET /api/partner/point-settlements", () => {
  beforeAll(async () => { await setupDB(); });
  afterAll(async () => { await teardownDB(); });
  beforeEach(async () => {
    await clearDB();
    vi.clearAllMocks();
  });

  it("인증 없으면 401", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(null);
    const { GET } = await import("@/app/api/partner/point-settlements/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("목록을 반환한다", async () => {
    vi.mocked(getSessionFromCookies).mockResolvedValue(mockSession() as any);
    const { GET } = await import("@/app/api/partner/point-settlements/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.items)).toBe(true);
  });
});
