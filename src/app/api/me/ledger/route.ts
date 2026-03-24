// src/app/api/me/ledger/route.ts
// =======================================================
// 로그인 사용자(PARTNER) 포인트 거래 내역
// -------------------------------------------------------
// ✔ 최근 100건 조회
// ✔ Ledger 기반
// =======================================================

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
import mongoose from "mongoose";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  await connectDB();

  const accountId = new mongoose.Types.ObjectId(session.uid);

  const docs = await Ledger.find({ accountId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const items = (docs as any[]).map((d) => ({
    id: String(d._id),
    type: d.type,
    amount: d.amount,
    note: d.note ?? "",
    refType: d.refType ?? null,
    refId: d.refId ? String(d.refId) : null,
    createdAt: d.createdAt,
  }));

  return NextResponse.json({
    ok: true,
    items,
  });
}