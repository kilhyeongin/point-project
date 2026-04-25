// src/app/api/partner/general-settlements/[id]/route.ts
// =======================================================
// PARTNER: 일반 정산 단건 조회 / 수정
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { GeneralSettlement } from "@/models/GeneralSettlement";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID입니다." }, { status: 400 });
  }

  await connectDB();
  const orgId = session.orgId ?? "4nwn";

  const doc = await GeneralSettlement.findOne({
    _id: id,
    organizationId: orgId,
    partnerId: new mongoose.Types.ObjectId(session.uid),
  }).lean() as any;

  if (!doc) {
    return NextResponse.json({ ok: false, message: "정산을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: String(doc._id),
      year: doc.year,
      month: doc.month,
      periodStart: doc.periodStart,
      periodEnd: doc.periodEnd,
      partnerName: doc.partnerName,
      columns: doc.columns,
      rows: doc.rows,
      subtotal: doc.subtotal,
      tax: doc.tax,
      total: doc.total,
      status: doc.status,
      submittedAt: doc.submittedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
  });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID입니다." }, { status: 400 });
  }

  await connectDB();
  const orgId = session.orgId ?? "4nwn";

  const doc = await GeneralSettlement.findOne({
    _id: id,
    organizationId: orgId,
    partnerId: new mongoose.Types.ObjectId(session.uid),
  }) as any;

  if (!doc) {
    return NextResponse.json({ ok: false, message: "정산을 찾을 수 없습니다." }, { status: 404 });
  }

  if (doc.status !== "DRAFT") {
    return NextResponse.json({ ok: false, message: "이미 전송된 정산은 수정할 수 없습니다." }, { status: 400 });
  }

  const body = await req.json();
  const { year, month, periodStart, periodEnd, columns, rows, subtotal, tax, total, status } = body;

  doc.year = year !== undefined ? Number(year) : doc.year;
  doc.month = month !== undefined ? Number(month) : doc.month;
  doc.periodStart = periodStart ?? doc.periodStart;
  doc.periodEnd = periodEnd ?? doc.periodEnd;
  doc.columns = columns ?? doc.columns;
  doc.rows = rows ?? doc.rows;
  doc.subtotal = subtotal !== undefined ? Number(subtotal) : doc.subtotal;
  doc.tax = tax !== undefined ? Number(tax) : doc.tax;
  doc.total = total !== undefined ? Number(total) : doc.total;

  if (status === "SUBMITTED") {
    doc.status = "SUBMITTED";
    doc.submittedAt = new Date();
  } else if (status === "DRAFT") {
    doc.status = "DRAFT";
  }

  await doc.save();

  return NextResponse.json({ ok: true, id: String(doc._id) });
}
