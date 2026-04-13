import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`change-pw:${ip}`, 5, 60 * 1000)) {
    return NextResponse.json(
      { ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 본문을 읽을 수 없습니다." },
      { status: 400 }
    );
  }

  const currentPassword = String(body?.currentPassword ?? "").trim();
  const newPassword = String(body?.newPassword ?? "").trim();
  const confirmPassword = String(body?.confirmPassword ?? "").trim();

  if (!currentPassword) {
    return NextResponse.json(
      { ok: false, message: "현재 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, message: "새 비밀번호는 8자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { ok: false, message: "새 비밀번호가 일치하지 않습니다." },
      { status: 400 }
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { ok: false, message: "새 비밀번호는 현재 비밀번호와 달라야 합니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const user = await User.findOne({ _id: session.uid, organizationId: session.orgId ?? "default" }, { passwordHash: 1 });

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "계정을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isMatch) {
    return NextResponse.json(
      { ok: false, message: "현재 비밀번호가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await User.updateOne({ _id: session.uid, organizationId: session.orgId ?? "default" }, { $set: { passwordHash: hashed } });

  return NextResponse.json({ ok: true, message: "비밀번호가 변경되었습니다." });
}
