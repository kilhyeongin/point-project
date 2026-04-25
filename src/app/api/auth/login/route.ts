import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { signSession, setSessionCookie } from "@/lib/auth";
import { isRateLimited, getRateLimitInfo, getClientIp } from "@/lib/rateLimit";

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (await isRateLimited(`login:${ip}`, 5, 2 * 60 * 1000)) {
    const info = await getRateLimitInfo(`login:${ip}`, 5, 2 * 60 * 1000);
    const retryAfter = Math.ceil((info.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { ok: false, message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const username = normalizeUsername(String(body?.username ?? ""));
    const password = String(body?.password ?? "");
    const orgSlug = String(body?.orgSlug ?? "").trim() || "4nwn";

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: "아이디와 비밀번호를 입력해 주세요." },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ username, organizationId: orgSlug });

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

    if (user.role === "PARTNER" && user.status === "PENDING") {
      return NextResponse.json(
        {
          ok: false,
          message: "제휴사 계정은 관리자 승인 후 로그인할 수 있습니다.",
        },
        { status: 403 }
      );
    }

    if (user.status === "BLOCKED") {
      return NextResponse.json(
        {
          ok: false,
          message: "차단된 계정입니다. 관리자에게 문의해 주세요.",
        },
        { status: 403 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          ok: false,
          message: `로그인할 수 없는 계정 상태입니다. (${user.status})`,
        },
        { status: 403 }
      );
    }

    const token = signSession({
      uid: user._id.toString(),
      role: user.role,
      username: user.username,
      name: user.name,
      orgId: user.organizationId ?? "4nwn",
    });

    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[AUTH_LOGIN_POST_ERROR]", error);
    return NextResponse.json(
      { ok: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}