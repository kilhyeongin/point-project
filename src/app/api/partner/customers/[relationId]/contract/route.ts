// src/app/api/partner/customers/[relationId]/contract/route.ts
// PARTNER: 고객을 계약완료 상태로 수동 처리

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FavoritePartner } from "@/models/FavoritePartner";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ relationId: string }> }
) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  const { relationId } = await params;

  if (!mongoose.Types.ObjectId.isValid(relationId)) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    await connectDB();

    const orgId = session.orgId ?? "4nwn";

    const relation = await FavoritePartner.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(relationId),
        organizationId: orgId,
        partnerId: new mongoose.Types.ObjectId(session.uid),
        status: "APPLIED",
      },
      { $set: { contractedAt: new Date() } },
      { new: true }
    );

    if (!relation) {
      return NextResponse.json({ ok: false, message: "해당 고객 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PARTNER_CONTRACT_PATCH_ERROR]", error);
    return NextResponse.json({ ok: false, message: "계약 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
