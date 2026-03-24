// src/app/api/admin/issue-requests/route.ts
// =======================================================
// ADMIN: 고객 포인트 지급 이력 조회 전용
// -------------------------------------------------------
// ✔ 더 이상 관리자 승인/거절용이 아님
// ✔ 제휴사가 실행한 지급 이력 조회
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { IssueRequest } from "@/models/IssueRequest";
import { User } from "@/models/User";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, message: "관리자만 접근 가능합니다." },
      { status: 403 }
    );
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const status = String(searchParams.get("status") ?? "ALL").toUpperCase();

  const filter: any = {};

  if (["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    filter.status = status;
  }

  if (q) {
    const matchedUsers = await User.find(
      {
        $or: [
          { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\$&"), $options: "i" } },
          { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\$&"), $options: "i" } },
        ],
      },
      { _id: 1 }
    ).limit(100);

    const ids = matchedUsers.map((u: any) => u._id);

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, items: [] });
    }

    filter.$or = [
      { requesterId: { $in: ids } },
      { userId: { $in: ids } },
    ];
  }

  const docs = await IssueRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(300);

  const requesterIds = docs
    .map((d: any) => d.requesterId)
    .filter(Boolean)
    .map((id: any) => String(id));

  const customerIds = docs
    .map((d: any) => d.userId)
    .filter(Boolean)
    .map((id: any) => String(id));

  const uniqueIds = [...new Set([...requesterIds, ...customerIds])]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const users = await User.find(
    { _id: { $in: uniqueIds } },
    { username: 1, name: 1, role: 1 }
  );

  const userMap = new Map(
    users.map((u: any) => [
      String(u._id),
      {
        id: String(u._id),
        username: u.username,
        name: u.name,
        role: u.role,
      },
    ])
  );

  const items = docs.map((d: any) => ({
    id: String(d._id),
    status: d.status,
    amount: d.amount,
    note: d.note ?? "",
    createdAt: d.createdAt,
    decidedAt: d.decidedAt ?? null,
    ledgerId: d.ledgerId ? String(d.ledgerId) : null,
    requester: d.requesterId ? userMap.get(String(d.requesterId)) ?? null : null,
    customer: d.userId ? userMap.get(String(d.userId)) ?? null : null,
  }));

  return NextResponse.json({ ok: true, items });
}