import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "@/lib/auth";

const basePayload = {
  uid: "507f1f77bcf86cd799439011",
  role: "PARTNER" as const,
  username: "testpartner",
  name: "테스트파트너",
  orgId: "4nwn",
};

describe("signSession / verifySession", () => {
  it("유효한 토큰을 생성한다", () => {
    const token = signSession(basePayload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // JWT 형식
  });

  it("생성한 토큰을 검증하면 페이로드가 반환된다", () => {
    const token = signSession(basePayload);
    const payload = verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload?.uid).toBe(basePayload.uid);
    expect(payload?.role).toBe(basePayload.role);
    expect(payload?.username).toBe(basePayload.username);
    expect(payload?.orgId).toBe(basePayload.orgId);
  });

  it("jti 필드가 포함된다", () => {
    const token = signSession(basePayload);
    const payload = verifySession(token);
    expect(typeof payload?.jti).toBe("string");
    expect(payload?.jti.length).toBeGreaterThan(0);
  });

  it("두 번 sign하면 jti가 다르다", () => {
    const t1 = signSession(basePayload);
    const t2 = signSession(basePayload);
    expect(verifySession(t1)?.jti).not.toBe(verifySession(t2)?.jti);
  });

  it("잘못된 토큰은 null을 반환한다", () => {
    expect(verifySession("invalid.token.here")).toBeNull();
  });

  it("빈 문자열은 null을 반환한다", () => {
    expect(verifySession("")).toBeNull();
  });

  it("다른 secret으로 서명된 토큰은 null을 반환한다", async () => {
    const jwt = await import("jsonwebtoken");
    const fakeToken = jwt.sign({ uid: "abc" }, "wrong-secret");
    expect(verifySession(fakeToken as string)).toBeNull();
  });
});
