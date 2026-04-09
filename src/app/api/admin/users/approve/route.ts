import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { ok: false, error: "관리자만 승인할 수 있습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const userId = String(body?.userId ?? "").trim();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "승인할 계정 정보가 없습니다." },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { ok: false, error: "올바르지 않은 계정 ID입니다." },
        { status: 400 }
      );
    }

    await connectDB();

    const orgId = session.orgId ?? "default";

    const target = await User.findOne({ _id: userId, organizationId: orgId });

    if (!target) {
      return NextResponse.json(
        { ok: false, error: "계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (target.role !== "PARTNER") {
      return NextResponse.json(
        { ok: false, error: "제휴사 계정만 승인할 수 있습니다." },
        { status: 400 }
      );
    }

    if (target.status === "ACTIVE") {
      return NextResponse.json({
        ok: true,
        message: "이미 승인된 계정입니다.",
      });
    }

    target.status = "ACTIVE";
    await target.save();

    return NextResponse.json({
      ok: true,
      message: "제휴사 계정이 승인되었습니다.",
    });
  } catch (error) {
    console.error("[ADMIN_USER_APPROVE_POST_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "제휴사 승인 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}