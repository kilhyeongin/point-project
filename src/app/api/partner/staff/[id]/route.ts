import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { PartnerStaff } from "@/models/PartnerStaff";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    await connectDB();
    const orgId = session.orgId ?? "4nwn";
    const partnerId = new mongoose.Types.ObjectId(session.uid);

    // 소유권 확인 포함 삭제 (코드는 DB에 남아 기존 가입자 기록 유지)
    const result = await PartnerStaff.findOneAndUpdate(
      { _id: id, organizationId: orgId, partnerId },
      { $set: { isActive: false } }
    );

    if (!result) {
      return NextResponse.json({ ok: false, error: "직원을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PARTNER_STAFF_DELETE_ERROR]", error);
    return NextResponse.json({ ok: false, error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
