// src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  if (await isRateLimited(`forgot-password:${getClientIp(req)}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "잠시 후 다시 시도해 주세요. (15분에 3회 제한)" },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const orgSlug = String(body?.orgSlug ?? "").trim() || "4nwn";

    if (!username) {
      return NextResponse.json(
        { ok: false, error: "아이디를 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "올바른 이메일 주소를 입력해 주세요." },
        { status: 400 }
      );
    }

    await connectDB();

    const userByUsername = await User.findOne({ username, organizationId: orgSlug }, { _id: 1, name: 1, email: 1, status: 1 }).lean();

    // 유저 존재 여부 노출 방지: 모든 경로에 동일한 지연 적용
    const delayMs = 400 + Math.random() * 200;

    if (
      !userByUsername ||
      (userByUsername as any).email !== email ||
      (userByUsername as any).status === "BLOCKED"
    ) {
      await new Promise((r) => setTimeout(r, delayMs));
      return NextResponse.json({ ok: true });
    }

    const user = userByUsername;

    const userId = (user as any)._id;

    // 기존 미사용 토큰 삭제
    await PasswordResetToken.deleteMany({ userId, used: false });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15분

    await PasswordResetToken.create({ userId, token, expiresAt });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

    if (process.env.NODE_ENV === "development") {
      logger.info("[DEV] 비밀번호 재설정 링크", { email, resetUrl });
    }

    await resend.emails.send({
      from,
      to: email,
      subject: "[포인트 관리 시스템] 비밀번호 재설정",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="font-size: 13px; font-weight: 800; color: #6b7280; margin-bottom: 8px;">
            포인트 관리 시스템
          </div>
          <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 900; color: #111827;">
            비밀번호 재설정
          </h1>
          <p style="color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
            안녕하세요, ${(user as any).name ?? ""}님.<br/>
            아래 버튼을 클릭하여 비밀번호를 재설정해 주세요.<br/>
            링크는 <strong>15분간</strong> 유효합니다.
          </p>
          <a href="${resetUrl}" style="
            display: inline-block;
            background: #4f46e5;
            color: white;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 15px;
            margin-bottom: 24px;
          ">비밀번호 재설정하기</a>
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
            본인이 요청하지 않은 경우 이 메일을 무시하세요.<br/>
            링크가 작동하지 않으면 아래 주소를 브라우저에 직접 붙여넣으세요.<br/>
            <span style="word-break: break-all; color: #6b7280;">${resetUrl}</span>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[FORGOT_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
