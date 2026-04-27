// 최초 슈퍼어드민 계정 생성용 엔드포인트
// PLATFORM_SECRET 헤더 필요 + 슈퍼어드민이 아직 없을 때만 동작
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { validatePassword } from "@/lib/validatePassword";

export async function POST(req: NextRequest) {
  const secret = process.env.PLATFORM_SECRET ?? "";
  if (!secret) return NextResponse.json({ ok: false, error: "PLATFORM_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "플랫폼 관리자").trim();

    if (!username || username.length < 4)
      return NextResponse.json({ ok: false, error: "아이디는 4자 이상이어야 합니다." }, { status: 400 });

    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) return NextResponse.json({ ok: false, error: pwCheck.error }, { status: 400 });

    await connectDB();

    const existing = await User.findOne({ role: "SUPER_ADMIN" }, { _id: 1 }).lean();
    if (existing) {
      return NextResponse.json({ ok: false, error: "슈퍼어드민 계정이 이미 존재합니다." }, { status: 409 });
    }

    const usernameExists = await User.findOne({ username, organizationId: "platform" }, { _id: 1 }).lean();
    if (usernameExists)
      return NextResponse.json({ ok: false, error: "이미 사용 중인 아이디입니다." }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({
      organizationId: "platform",
      username,
      passwordHash,
      name,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      pointBalance: 0,
    });

    return NextResponse.json({ ok: true, message: `슈퍼어드민 계정 생성 완료: ${username}` });
  } catch (error) {
    console.error("[SUPER_ADMIN_SETUP_ERROR]", error);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
