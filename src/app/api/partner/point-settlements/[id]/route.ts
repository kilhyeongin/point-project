import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PointSettlementPayment } from "@/models/PointSettlementPayment";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE: 포인트 정산 취소
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER")
    return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ ok: false, message: "잘못된 ID입니다." }, { status: 400 });

  try {
    await connectDB();
    const orgId = session.orgId ?? "4nwn";
    const partnerId = new mongoose.Types.ObjectId(session.uid);

    const doc = await PointSettlementPayment.findOneAndUpdate(
      { _id: id, organizationId: orgId, partnerId, status: "PENDING" },
      { $set: { status: "CANCELLED", cancelledAt: new Date() } },
      { new: true }
    );

    if (!doc) {
      const exists = await PointSettlementPayment.findOne({ _id: id, organizationId: orgId, partnerId }, { status: 1 }).lean();
      if (!exists) return NextResponse.json({ ok: false, message: "요청을 찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json({ ok: false, message: "대기중인 요청만 취소할 수 있습니다." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PARTNER_POINT_SETTLEMENT_DELETE_ERROR]", error);
    return NextResponse.json({ ok: false, message: "정산 취소 중 오류가 발생했습니다." }, { status: 500 });
  }
}
