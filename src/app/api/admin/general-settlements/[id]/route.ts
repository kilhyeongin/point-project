import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { GeneralSettlement } from "@/models/GeneralSettlement";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH: 관리자 - 정산서 확인처리 (SUBMITTED → CONFIRMED)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ ok: false }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID입니다." }, { status: 400 });
  }

  await connectDB();

  const doc = await GeneralSettlement.findOne({
    _id: id,
    organizationId: session.orgId ?? "4nwn",
  }) as any;

  if (!doc) return NextResponse.json({ ok: false, message: "정산을 찾을 수 없습니다." }, { status: 404 });
  if (doc.status !== "SUBMITTED") {
    return NextResponse.json({ ok: false, message: "대기중인 정산만 확인처리할 수 있습니다." }, { status: 400 });
  }

  doc.status = "CONFIRMED";
  doc.confirmedAt = new Date();
  await doc.save();

  return NextResponse.json({ ok: true });
}
