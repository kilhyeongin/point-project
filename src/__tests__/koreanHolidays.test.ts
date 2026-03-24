import { describe, it, expect } from "vitest";
import { isKoreanHoliday, getHolidayName } from "@/lib/koreanHolidays";

describe("koreanHolidays", () => {
  it("신정(2025-01-01)은 공휴일이다", () => {
    expect(isKoreanHoliday("2025-01-01")).toBe(true);
  });

  it("설날(2025-01-29)은 공휴일이다", () => {
    expect(isKoreanHoliday("2025-01-29")).toBe(true);
  });

  it("추석(2025-10-06)은 공휴일이다", () => {
    expect(isKoreanHoliday("2025-10-06")).toBe(true);
  });

  it("평일(2025-03-03)은 공휴일이 아니다", () => {
    expect(isKoreanHoliday("2025-03-03")).toBe(false);
  });

  it("getHolidayName은 공휴일 이름을 반환한다", () => {
    expect(getHolidayName("2025-12-25")).toBe("크리스마스");
  });

  it("getHolidayName은 평일에 null/undefined를 반환한다", () => {
    expect(getHolidayName("2025-04-01")).toBeFalsy();
  });

  it("2028년 공휴일을 포함한다", () => {
    expect(isKoreanHoliday("2028-01-01")).toBe(true);
  });

  it("2030년 크리스마스는 공휴일이다", () => {
    expect(isKoreanHoliday("2030-12-25")).toBe(true);
  });
});
