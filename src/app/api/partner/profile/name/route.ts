import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (session.role !== "PARTNER") {
      return NextResponse.json(
        { ok: false, error: "제휴사 계정만 접근할 수 있습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = String(body?.name ?? "").trim().slice(0, 100);

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "업체명을 입력해주세요." },
        { status: 400 }
      );
    }

    await connectDB();

    const updated = await User.findOneAndUpdate(
      { _id: session.uid, role: "PARTNER" },
      { $set: { name } },
      { new: true, projection: { name: 1 } }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "업체명이 저장되었습니다.",
      item: {
        name: String((updated as any).name ?? ""),
      },
    });
  } catch (error) {
    console.error("[PARTNER_PROFILE_NAME_PATCH_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
