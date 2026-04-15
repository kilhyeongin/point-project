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

  await connectDB();
  const orgId = session.orgId ?? "4nwn";
  const partnerId = new mongoose.Types.ObjectId(session.uid);

  const doc = await PointSettlementPayment.findOne({ _id: id, organizationId: orgId, partnerId });
  if (!doc)
    return NextResponse.json({ ok: false, message: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (doc.status !== "PENDING")
    return NextResponse.json({ ok: false, message: "대기중인 요청만 취소할 수 있습니다." }, { status: 400 });

  doc.status = "CANCELLED";
  doc.cancelledAt = new Date();
  await doc.save();

  return NextResponse.json({ ok: true });
}
