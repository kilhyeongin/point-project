import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { connectDB } from "@/lib/db";
import { VerificationCode } from "@/models/VerificationCode";
import { User } from "@/models/User";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`send-verification:${ip}`, 3, 10 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "잠시 후 다시 시도해 주세요. (10분에 3회 제한)" },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "올바른 이메일 주소를 입력해 주세요." },
        { status: 400 }
      );
    }

    await connectDB();

    const exists = await User.findOne({ email }, { _id: 1 }).lean();
    if (exists) {
      return NextResponse.json(
        { ok: false, error: "이미 사용 중인 이메일입니다." },
        { status: 409 }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분

    // 기존 코드 덮어쓰기 (upsert)
    await VerificationCode.findOneAndUpdate(
      { email },
      { code, expiresAt },
      { upsert: true }
    );

    // 개발 모드에서는 터미널에 코드 출력
    if (process.env.NODE_ENV === "development") {
      console.log(`\n📧 [이메일 인증 코드] ${email} → ${code}\n`);
    }

    const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

    await resend.emails.send({
      from,
      to: email,
      subject: "[포인트 관리 시스템] 이메일 인증 코드",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="font-size: 13px; font-weight: 800; color: #6b7280; margin-bottom: 8px;">
            포인트 관리 시스템
          </div>
          <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 900; color: #111827;">
            이메일 인증
          </h1>
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
            아래 인증 코드를 입력하여 이메일을 인증해 주세요.<br/>
            코드는 <strong>10분간</strong> 유효합니다.
          </p>
          <div style="
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            margin-bottom: 24px;
          ">
            <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #111827;">
              ${code}
            </div>
          </div>
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
            본인이 요청하지 않은 경우 이 메일을 무시하세요.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, message: "인증 코드가 발송되었습니다." });
  } catch (error) {
    console.error("[SEND_VERIFICATION_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "인증 코드 발송에 실패했습니다." },
      { status: 500 }
    );
  }
}
