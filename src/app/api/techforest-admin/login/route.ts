import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { signSession, setSessionCookie } from "@/lib/auth";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

export async function POST(req: Request) {
  if (await isRateLimited(`techforest-admin-login:${getClientIp(req)}`, 5, 2 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: "아이디와 비밀번호를 입력해 주세요." },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ username, role: "SUPER_ADMIN" });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const passwordMatched = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatched) {
      return NextResponse.json(
        { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, message: "비활성 계정입니다." },
        { status: 403 }
      );
    }

    const token = signSession({
      uid: user._id.toString(),
      role: "SUPER_ADMIN",
      username: user.username,
      name: user.name,
      orgId: "platform",
    });

    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[SUPER_ADMIN_LOGIN_ERROR]", error);
    return NextResponse.json(
      { ok: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
