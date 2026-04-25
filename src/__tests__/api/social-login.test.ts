import { describe, it, expect } from "vitest";

// 카카오/네이버 이름 파싱 로직을 직접 테스트

describe("카카오 이름 파싱", () => {
  function parseKakaoName(kakaoAccount?: {
    name?: string;
    profile?: { nickname?: string };
  }) {
    return kakaoAccount?.name ?? "카카오 사용자";
  }

  it("name 필드가 있으면 name 반환", () => {
    expect(parseKakaoName({ name: "홍길동" })).toBe("홍길동");
  });

  it("name이 없으면 기본값 반환", () => {
    expect(parseKakaoName({})).toBe("카카오 사용자");
  });

  it("kakao_account 자체가 없으면 기본값", () => {
    expect(parseKakaoName(undefined)).toBe("카카오 사용자");
  });
});

describe("카카오 전화번호 파싱", () => {
  function parseKakaoPhone(rawPhone: string) {
    return rawPhone
      .replace("+82 ", "0")
      .replace(/-/g, "")
      .replace(/\s/g, "");
  }

  it("+82 형식을 01x 형식으로 변환", () => {
    expect(parseKakaoPhone("+82 10-1234-5678")).toBe("01012345678");
  });

  it("이미 01x 형식이면 그대로", () => {
    expect(parseKakaoPhone("010-1234-5678")).toBe("01012345678");
  });

  it("빈 문자열은 빈 문자열", () => {
    expect(parseKakaoPhone("")).toBe("");
  });
});

describe("네이버 이름 파싱", () => {
  function parseNaverName(name?: string) {
    return name ?? "네이버 사용자";
  }

  it("name 있으면 그대로 반환", () => {
    expect(parseNaverName("김철수")).toBe("김철수");
  });

  it("name 없으면 기본값", () => {
    expect(parseNaverName(undefined)).toBe("네이버 사용자");
  });
});

describe("네이버 전화번호 파싱", () => {
  function parseNaverPhone(mobile?: string) {
    return mobile?.replace(/-/g, "") ?? "";
  }

  it("010-xxxx-xxxx 형식을 01012345678으로 변환", () => {
    expect(parseNaverPhone("010-1234-5678")).toBe("01012345678");
  });

  it("mobile 없으면 빈 문자열", () => {
    expect(parseNaverPhone(undefined)).toBe("");
  });
});

describe("기존 유저 이름 갱신 조건", () => {
  function shouldUpdateName(currentName: string, newName: string, defaultNames: string[]) {
    return !!newName && (!currentName || defaultNames.includes(currentName));
  }

  it("이름이 기본값이면 갱신한다", () => {
    expect(shouldUpdateName("카카오 사용자", "홍길동", ["카카오 사용자"])).toBe(true);
    expect(shouldUpdateName("네이버 사용자", "김철수", ["네이버 사용자"])).toBe(true);
  });

  it("이름이 비어있으면 갱신한다", () => {
    expect(shouldUpdateName("", "홍길동", ["카카오 사용자"])).toBe(true);
  });

  it("이름이 이미 있으면 갱신하지 않는다", () => {
    expect(shouldUpdateName("홍길동", "이름변경", ["카카오 사용자"])).toBe(false);
  });

  it("새 이름이 없으면 갱신하지 않는다", () => {
    expect(shouldUpdateName("카카오 사용자", "", ["카카오 사용자"])).toBe(false);
  });
});
