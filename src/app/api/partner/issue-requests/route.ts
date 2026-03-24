// src/app/api/partner/issue-requests/route.ts
// PARTNER 전용: 내가 실행한 고객 포인트 지급 이력 조회

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { IssueRequest } from "@/models/IssueRequest";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = String(searchParams.get("status") ?? "ALL").toUpperCase();

  await connectDB();

  const filter: any = {
    requesterId: new mongoose.Types.ObjectId(session.uid),
  };
  if (["PENDING", "APPROVED", "REJECTED"].includes(statusParam)) {
    filter.status = statusParam;
  }

  const docs = await IssueRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("userId", "username name")
    .lean();

  const items = docs.map((d: any) => ({
    id: String(d._id),
    status: d.status,
    amount: d.amount,
    note: d.note ?? "",
    createdAt: d.createdAt,
    decidedAt: d.decidedAt ?? null,
    ledgerId: d.ledgerId ? String(d.ledgerId) : null,
    to: d.userId ? { username: d.userId.username, name: d.userId.name } : null,
  }));

  return NextResponse.json({ ok: true, items });
}
