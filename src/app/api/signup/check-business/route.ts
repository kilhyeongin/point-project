import { NextRequest, NextResponse } from "next/server";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

// 업체명 정규화 (법인 표기, 공백 제거 후 비교)
function normalizeName(name: string): string {
  return name
    .replace(/\(주\)|\(유\)|\(합\)|\(사\)/g, "")
    .replace(/주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|영농조합법인|농업회사법인/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// 사업자등록번호 체크섬 검증
function validateBusinessNumber(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10) return false;

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * weights[i];
  }
  sum += Math.floor((Number(digits[8]) * 5) / 10);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(digits[9]);
}

export async function POST(req: NextRequest) {
  if (await isRateLimited(`check-business:${getClientIp(req)}`, 10, 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const raw = String(body?.businessNumber ?? "").trim();
    const digits = raw.replace(/\D/g, "");
    const businessName = String(body?.businessName ?? "").trim();

    if (digits.length !== 10) {
      return NextResponse.json(
        { ok: false, error: "사업자등록번호 10자리를 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!validateBusinessNumber(digits)) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 사업자등록번호입니다." },
        { status: 400 }
      );
    }

    const apiKey = process.env.NTS_API_KEY;

    // API 키가 없으면 인증 불가 처리 (보안상 형식 검증만으로 통과 허용 금지)
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "사업자 인증 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요." },
        { status: 503 }
      );
    }

    // 국세청 사업자등록정보 상태조회 API
    const ntsRes = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ b_no: [digits] }),
      }
    );

    if (!ntsRes.ok) {
      return NextResponse.json(
        { ok: false, error: "국세청 인증 서버에 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    const ntsData = await ntsRes.json();
    const result = ntsData?.data?.[0];

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "사업자등록번호를 확인할 수 없습니다." },
        { status: 400 }
      );
    }

    // b_stt_cd: "01" 계속사업자, "02" 휴업자, "03" 폐업자
    if (result.b_stt_cd === "02") {
      return NextResponse.json(
        { ok: false, error: "휴업 상태의 사업자등록번호입니다." },
        { status: 400 }
      );
    }

    if (result.b_stt_cd === "03") {
      return NextResponse.json(
        { ok: false, error: "폐업된 사업자등록번호입니다." },
        { status: 400 }
      );
    }

    if (result.b_stt_cd !== "01") {
      return NextResponse.json(
        { ok: false, error: "등록되지 않은 사업자등록번호입니다." },
        { status: 400 }
      );
    }

    // 업체명 일치 여부 검증
    if (businessName && result.b_nm) {
      const inputNorm = normalizeName(businessName);
      const apiNorm = normalizeName(result.b_nm);
      if (inputNorm !== apiNorm) {
        return NextResponse.json(
          { ok: false, error: "업체명이 사업자등록번호와 일치하지 않습니다." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: `사업자 확인 완료: ${result.b_nm ?? ""}`,
    });
  } catch (error) {
    console.error("[CHECK_BUSINESS_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
