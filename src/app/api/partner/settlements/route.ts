// src/app/api/partner/settlements/route.ts
// =======================================================
// PARTNER: 내 정산 목록 조회
// -------------------------------------------------------
// - 수수료 없음
// - netPayable = usedPoints
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "제휴사만 접근 가능합니다." },
      { status: 403 }
    );
  }

  await connectDB();

  const counterpartyId = new mongoose.Types.ObjectId(session.uid);

  const rows = await Settlement.find({ counterpartyId })
    .sort({ periodKey: -1, createdAt: -1 })
    .lean();

  return NextResponse.json({
    ok: true,
    items: rows.map((r: any) => ({
      id: String(r._id),
      periodKey: r.periodKey,
      usedPoints: Number(r.usedPoints ?? 0),
      netPayable: Number(r.netPayable ?? r.usedPoints ?? 0),
      status: r.status,
      paidAt: r.paidAt ?? null,
      payoutRef: r.payoutRef ?? "",
      note: r.note ?? "",
    })),
  });
}