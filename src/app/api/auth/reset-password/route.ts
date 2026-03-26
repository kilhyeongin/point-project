// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { validatePassword } from "@/lib/validatePassword";

export async function POST(req: NextRequest) {
  if (await isRateLimited(`reset-password:${getClientIp(req)}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const token = String(body?.token ?? "").trim();
    const password = String(body?.password ?? "");

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 링크입니다." },
        { status: 400 }
      );
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) {
      return NextResponse.json({ ok: false, error: pwCheck.error }, { status: 400 });
    }

    await connectDB();

    const resetToken = await PasswordResetToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetToken) {
      return NextResponse.json(
        { ok: false, error: "링크가 만료되었거나 이미 사용된 링크입니다." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.updateOne(
      { _id: resetToken.userId },
      { $set: { passwordHash } }
    );

    await PasswordResetToken.updateOne(
      { _id: resetToken._id },
      { $set: { used: true } }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[RESET_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 토큰 유효성만 확인 (페이지 진입 시)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json({ ok: false, valid: false });
  }

  await connectDB();

  const exists = await PasswordResetToken.findOne({
    token,
    used: false,
    expiresAt: { $gt: new Date() },
  }, { _id: 1 }).lean();

  return NextResponse.json({ ok: true, valid: !!exists });
}
