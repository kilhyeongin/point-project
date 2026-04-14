import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { validatePassword } from "@/lib/validatePassword";

function text(value: unknown, max = 100) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase().slice(0, 30);
}

function normalizePhone(value: unknown) {
  return String(value ?? "")
    .replace(/[^\d\-+\s()]/g, "")
    .trim()
    .slice(0, 30);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`signup:${ip}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "잠시 후 다시 시도해 주세요. (1시간에 3회 제한)" },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    const businessName = text(body?.businessName, 100);
    const businessNumber = String(body?.businessNumber ?? "").replace(/\D/g, "").slice(0, 10);
    const contactName = text(body?.contactName, 50);
    const username = normalizeUsername(body?.username);
    const password = String(body?.password ?? "");
    const passwordConfirm = String(body?.passwordConfirm ?? "");
    const contactPhone = normalizePhone(body?.contactPhone);
    const contactEmail = String(body?.contactEmail ?? "").trim().toLowerCase();
    const address = text(body?.address, 200);
    const detailAddress = text(body?.detailAddress, 200);

    if (!businessName) {
      return NextResponse.json({ ok: false, error: "업체명을 입력해 주세요." }, { status: 400 });
    }

    if (!businessNumber || businessNumber.length !== 10) {
      return NextResponse.json({ ok: false, error: "사업자등록번호를 인증해 주세요." }, { status: 400 });
    }

    if (!contactName) {
      return NextResponse.json({ ok: false, error: "담당자명을 입력해 주세요." }, { status: 400 });
    }

    if (!username || username.length < 4) {
      return NextResponse.json({ ok: false, error: "아이디는 4자 이상 입력해 주세요." }, { status: 400 });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) {
      return NextResponse.json({ ok: false, error: pwCheck.error }, { status: 400 });
    }

    if (password !== passwordConfirm) {
      return NextResponse.json({ ok: false, error: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
    }

    if (!contactPhone) {
      return NextResponse.json({ ok: false, error: "담당자 전화번호를 입력해 주세요." }, { status: 400 });
    }

    if (!address) {
      return NextResponse.json({ ok: false, error: "업체 주소를 입력해 주세요." }, { status: 400 });
    }

    await connectDB();

    const passwordHash = await bcrypt.hash(password, 12);

    const organizationId = String(body?.organizationId ?? "4nwn").trim() || "4nwn";

    const exists = await User.findOne({ username, organizationId }, { _id: 1 }).lean();
    if (exists) {
      return NextResponse.json({ ok: false, error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }

    await User.create({
      organizationId,
      username,
      passwordHash,
      name: businessName,
      role: "PARTNER",
      status: "PENDING",
      pointBalance: 0,
      partnerProfile: {
        businessName,
        businessNumber,
        contactName,
        contactPhone,
        contactEmail,
        address,
        detailAddress,
        phone: contactPhone,
        category: "",
        categories: [],
        intro: "",
        benefitText: "",
        kakaoChannelUrl: "",
        applyUrl: "",
        coverImageUrl: "",
        isPublished: false,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "제휴사 가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.",
    });
  } catch (error) {
    console.error("[PARTNER_SIGNUP_POST_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "제휴사 회원가입에 실패했습니다." },
      { status: 500 }
    );
  }
}