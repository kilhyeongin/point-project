import { describe, it, expect } from "vitest";
import { validatePassword } from "@/lib/validatePassword";

describe("validatePassword", () => {
  it("8자 미만은 실패", () => {
    expect(validatePassword("abc12").ok).toBe(false);
  });

  it("72자 초과는 실패", () => {
    expect(validatePassword("a1" + "x".repeat(72)).ok).toBe(false);
  });

  it("영문만 있으면 실패", () => {
    expect(validatePassword("abcdefgh").ok).toBe(false);
  });

  it("숫자만 있으면 실패", () => {
    expect(validatePassword("12345678").ok).toBe(false);
  });

  it("특수문자만 있으면 실패", () => {
    expect(validatePassword("!@#$%^&*").ok).toBe(false);
  });

  it("영문 + 숫자는 통과", () => {
    expect(validatePassword("abcd1234").ok).toBe(true);
  });

  it("영문 + 특수문자는 통과", () => {
    expect(validatePassword("abcd!@#$").ok).toBe(true);
  });

  it("숫자 + 특수문자는 통과", () => {
    expect(validatePassword("1234!@#$").ok).toBe(true);
  });

  it("영문 + 숫자 + 특수문자는 통과", () => {
    expect(validatePassword("abc123!@").ok).toBe(true);
  });

  it("정확히 8자는 통과", () => {
    expect(validatePassword("abcd1234").ok).toBe(true);
  });

  it("정확히 72자는 통과", () => {
    expect(validatePassword("a1" + "b".repeat(70)).ok).toBe(true);
  });

  it("빈 문자열은 실패", () => {
    expect(validatePassword("").ok).toBe(false);
  });

  it("에러 메시지가 있다", () => {
    const result = validatePassword("abc");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
