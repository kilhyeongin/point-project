import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { VerificationCode } from "@/models/VerificationCode";
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

    const name = text(body?.name, 50);
    const username = normalizeUsername(body?.username);
    const password = String(body?.password ?? "");
    const passwordConfirm = String(body?.passwordConfirm ?? "");
    const phone = normalizePhone(body?.phone);
    const address = text(body?.address, 200);
    const detailAddress = text(body?.detailAddress, 200);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const verificationCode = String(body?.verificationCode ?? "").trim();

    if (!name) {
      return NextResponse.json({ ok: false, error: "이름을 입력해 주세요." }, { status: 400 });
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

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
    }

    if (!verificationCode) {
      return NextResponse.json({ ok: false, error: "이메일 인증을 완료해 주세요." }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ ok: false, error: "전화번호를 입력해 주세요." }, { status: 400 });
    }

    if (!address) {
      return NextResponse.json({ ok: false, error: "주소를 입력해 주세요." }, { status: 400 });
    }

    const organizationId = String(body?.organizationId ?? "4nwn").trim() || "4nwn";

    await connectDB();

    // 이메일 인증 코드 검증 (atomic: 조회+삭제 동시 처리로 race condition 방지)
    const record = await VerificationCode.findOneAndDelete({
      email,
      organizationId,
      code: verificationCode,
      expiresAt: { $gt: new Date() },
    }).lean() as any;

    if (!record) {
      // 코드가 없거나, 만료되었거나, 틀렸거나 — 원인별 메시지 제공
      const anyRecord = await VerificationCode.findOne({ email, organizationId }, { expiresAt: 1, code: 1 }).lean() as any;
      if (!anyRecord) {
        return NextResponse.json(
          { ok: false, error: "인증 코드가 없습니다. 인증 코드를 다시 발송해 주세요." },
          { status: 400 }
        );
      }
      if (new Date() > new Date(anyRecord.expiresAt)) {
        return NextResponse.json(
          { ok: false, error: "인증 코드가 만료되었습니다. 인증 코드를 다시 발송해 주세요." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "인증 코드가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 중복 확인 (org 범위)
    const existsUsername = await User.findOne({ username, organizationId }, { _id: 1 }).lean();
    if (existsUsername) {
      return NextResponse.json({ ok: false, error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }

    const existsEmail = await User.findOne({ email, organizationId }, { _id: 1, socialAccounts: 1 }).lean() as any;
    if (existsEmail) {
      const providers: string[] = Array.isArray(existsEmail.socialAccounts)
        ? existsEmail.socialAccounts.map((s: { provider: string }) => s.provider)
        : [];
      if (providers.length > 0) {
        const labels = providers.map(p => p === "kakao" ? "카카오" : p === "naver" ? "네이버" : p).join(", ");
        return NextResponse.json({ ok: false, error: `이 이메일은 ${labels} 로그인으로 가입되어 있습니다. ${labels}로 로그인해 주세요.` }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }

    // 전화번호 중복 확인
    const normalizedPhone = phone.replace(/[^\d]/g, "");
    if (normalizedPhone) {
      const existsPhone = await User.findOne({ "customerProfile.phone": normalizedPhone, organizationId }, { _id: 1, socialAccounts: 1 }).lean() as any;
      if (existsPhone) {
        const providers: string[] = Array.isArray(existsPhone.socialAccounts)
          ? existsPhone.socialAccounts.map((s: { provider: string }) => s.provider)
          : [];
        if (providers.length > 0) {
          const labels = providers.map(p => p === "kakao" ? "카카오" : p === "naver" ? "네이버" : p).join(", ");
          return NextResponse.json({ ok: false, error: `이 전화번호는 ${labels} 로그인으로 가입되어 있습니다. ${labels}로 로그인해 주세요.` }, { status: 409 });
        }
        return NextResponse.json({ ok: false, error: "이미 사용 중인 전화번호입니다." }, { status: 409 });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      organizationId,
      username,
      passwordHash,
      name,
      email,
      role: "CUSTOMER",
      status: "ACTIVE",
      pointBalance: 0,
      customerProfile: {
        phone,
        address,
        detailAddress,
        onboardingCompleted: false,
        interests: [],
      },
    });

    // 인증 코드는 findOneAndDelete에서 이미 삭제됨

    return NextResponse.json({
      ok: true,
      message: "고객 회원가입이 완료되었습니다.",
    });
  } catch (error) {
    console.error("[CUSTOMER_SIGNUP_POST_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "고객 회원가입에 실패했습니다." },
      { status: 500 }
    );
  }
}
