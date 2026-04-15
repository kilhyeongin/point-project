// src/app/api/partner/general-settlements/route.ts
// =======================================================
// PARTNER: 일반 정산 목록 조회 + 생성
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { GeneralSettlement } from "@/models/GeneralSettlement";
import { User } from "@/models/User";

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
  const orgId = session.orgId ?? "4nwn";

  const items = await GeneralSettlement.find({ organizationId: orgId, partnerId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean() as any[];

  return NextResponse.json({
    ok: true,
    items: items.map((item) => ({
      id: String(item._id),
      year: item.year,
      month: item.month,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      partnerName: item.partnerName,
      columns: item.columns,
      rows: item.rows,
      subtotal: item.subtotal,
      tax: item.tax,
      total: item.total,
      status: item.status,
      submittedAt: item.submittedAt ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  await connectDB();

  const body = await req.json();
  const { year, month, periodStart, periodEnd, columns, rows, subtotal, tax, total, status } = body;

  const partnerId = new mongoose.Types.ObjectId(session.uid);
  const orgId = session.orgId ?? "4nwn";

  // Get partner name from User record
  const user = await (User as any).findOne({ _id: partnerId }).lean() as any;
  const partnerName =
    (user?.partnerProfile?.businessName || user?.name || session.name || "").trim();

  const doc = await GeneralSettlement.create({
    organizationId: orgId,
    partnerId,
    partnerName,
    year: Number(year),
    month: Number(month),
    periodStart: periodStart ?? "",
    periodEnd: periodEnd ?? "",
    columns: columns ?? ["예식일", "출발일", "손님 성함", "여행지", "정산", "비고"],
    rows: rows ?? [],
    subtotal: Number(subtotal ?? 0),
    tax: Number(tax ?? 0),
    total: Number(total ?? 0),
    status: status === "SUBMITTED" ? "SUBMITTED" : "DRAFT",
    submittedAt: status === "SUBMITTED" ? new Date() : null,
  });

  return NextResponse.json({ ok: true, id: String(doc._id) }, { status: 201 });
}
