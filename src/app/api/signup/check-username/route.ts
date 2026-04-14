import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  if (await isRateLimited(`check-username:${getClientIp(req)}`, 10, 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim().toLowerCase();

    if (!username || username.length < 4) {
      return NextResponse.json({ ok: false, error: "아이디는 4자 이상 입력해 주세요." }, { status: 400 });
    }

    if (!/^[a-z0-9]+$/.test(username)) {
      return NextResponse.json({ ok: false, error: "아이디는 영문 소문자와 숫자만 사용할 수 있습니다." }, { status: 400 });
    }

    await connectDB();

    const orgId = String(body?.organizationId ?? "4nwn");
    const exists = await User.findOne({ username, organizationId: orgId }, { _id: 1 }).lean();
    if (exists) {
      return NextResponse.json({ ok: false, error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, message: "사용 가능한 아이디입니다." });
  } catch (error) {
    console.error("[CHECK_USERNAME_ERROR]", error);
    return NextResponse.json({ ok: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
