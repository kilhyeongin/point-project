// src/app/api/partner/point-history/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  await connectDB();

  const partnerId = new mongoose.Types.ObjectId(session.uid);

  const rows = await Ledger.find({
    actorId: partnerId,
    type: { $in: ["ISSUE", "USE"] },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("userId", "username name")
    .lean();

  const items = rows.map((r: any) => ({
    id: String(r._id),
    type: r.type,
    amount: r.amount,
    note: r.note ?? "",
    createdAt: r.createdAt,
    customer: r.userId
      ? { username: r.userId.username, name: r.userId.name }
      : null,
  }));

  return NextResponse.json({ ok: true, items });
}
