// src/app/api/partner/customers/route.ts
// PARTNER: 나에게 신청(APPLIED)한 고객 목록 조회

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FavoritePartner } from "@/models/FavoritePartner";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, error: "제휴사만 접근할 수 있습니다." }, { status: 403 });
  }

  await connectDB();

  const docs = await FavoritePartner.find(
    { partnerId: session.uid, status: "APPLIED" },
    { customerId: 1, createdAt: 1, appliedAt: 1 }
  )
    .populate("customerId", "username name")
    .sort({ appliedAt: -1, createdAt: -1 })
    .limit(200)
    .lean();

  const items = (docs as any[]).map((d) => ({
    id: String(d._id),
    customerId: String(d.customerId?._id ?? d.customerId),
    username: d.customerId?.username ?? "",
    name: d.customerId?.name ?? "",
    appliedAt: d.appliedAt ?? d.createdAt,
  }));

  return NextResponse.json({ ok: true, items });
}
