// src/app/api/topup-requests/route.ts
// =======================================================
// PARTNER: 충전 요청 생성 + 내 충전 요청 목록 조회
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { TopupRequest } from "@/models/TopupRequest";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "업체만 접근 가능합니다." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const statusParam = String(searchParams.get("status") ?? "ALL").toUpperCase();

  await connectDB();

  const filter: any = {
    organizationId: session.orgId ?? "4nwn",
    accountId: new mongoose.Types.ObjectId(session.uid),
  };

  if (["PENDING", "APPROVED", "REJECTED"].includes(statusParam)) {
    filter.status = statusParam;
  }

  const docs = await TopupRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100);

  return NextResponse.json({
    ok: true,
    items: docs.map((d: any) => ({
      id: String(d._id),
      amount: d.amount,
      status: d.status,
      note: d.note ?? "",
      createdAt: d.createdAt,
      decidedAt: d.decidedAt ?? null,
      ledgerId: d.ledgerId ? String(d.ledgerId) : null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "업체만 충전 요청을 생성할 수 있습니다." },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const amount = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, message: "충전 금액은 1 이상이어야 합니다." },
      { status: 400 }
    );
  }

  const HARD_MAX = 1_000_000_000;
  if (amount > HARD_MAX) {
    return NextResponse.json(
      { ok: false, message: "충전 금액이 너무 큽니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const accountId = new mongoose.Types.ObjectId(session.uid);

  const doc = await TopupRequest.create({
    organizationId: session.orgId ?? "4nwn",
    accountId,
    amount,
    status: "PENDING",
    requestedById: accountId,
    approvedById: null,
    ledgerId: null,
    note,
    decidedAt: null,
  });

  return NextResponse.json({
    ok: true,
    id: String(doc._id),
  });
}