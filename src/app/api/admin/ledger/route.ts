// src/app/api/admin/ledger/route.ts
// =======================================================
// ADMIN 전용: 원장(Ledger) 조회 API
// =======================================================

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
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
      { ok: false, message: "관리자 권한이 없습니다." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const typeParam = String(searchParams.get("type") ?? "ALL").toUpperCase();
  const q = String(searchParams.get("q") ?? "").trim();
  const roleParam = String(searchParams.get("role") ?? "").toUpperCase();
  const startParam = searchParams.get("start") ?? "";
  const endParam = searchParams.get("end") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 50;
  const skip = (page - 1) * limit;

  await connectDB();

  const orgId = session.orgId ?? "4nwn";
  const filter: any = { organizationId: orgId };

  if (["TOPUP", "ISSUE", "USE", "ADJUST"].includes(typeParam)) {
    filter.type = typeParam;
  }

  if (startParam || endParam) {
    filter.createdAt = {};
    if (startParam) filter.createdAt.$gte = new Date(startParam + "T00:00:00.000+09:00");
    if (endParam) filter.createdAt.$lte = new Date(endParam + "T23:59:59.999+09:00");
  }

  // role 필터 또는 이름/아이디 검색
  if (q || ["PARTNER", "CUSTOMER", "ADMIN"].includes(roleParam)) {
    const userFilter: any = { organizationId: orgId };
    if (["PARTNER", "CUSTOMER", "ADMIN"].includes(roleParam)) userFilter.role = roleParam;
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      userFilter.$or = [
        { username: { $regex: escaped, $options: "i" } },
        { name: { $regex: escaped, $options: "i" } },
      ];
    }
    const users = await User.find(userFilter, { _id: 1 }).limit(200);
    const ids = users.map((u: any) => u._id);
    filter.accountId = { $in: ids };
  }

  const [docs, total] = await Promise.all([
    Ledger.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("accountId", "username name role")
      .populate("userId", "username name role")
      .populate("actorId", "username name role")
      .lean(),
    Ledger.countDocuments(filter),
  ]);

  const items = (docs as any[]).map((d) => ({
    id: String(d._id),
    type: d.type,
    amount: d.amount,
    note: d.note ?? "",
    createdAt: d.createdAt,
    refType: d.refType ?? null,
    refId: d.refId ? String(d.refId) : null,
    account: d.accountId
      ? {
          id: String(d.accountId._id),
          username: d.accountId.username,
          name: d.accountId.name,
          role: d.accountId.role,
        }
      : null,
    user: d.userId
      ? {
          id: String(d.userId._id),
          username: d.userId.username,
          name: d.userId.name,
          role: d.userId.role,
        }
      : null,
    actor: d.actorId
      ? {
          id: String(d.actorId._id),
          username: d.actorId.username,
          name: d.actorId.name,
          role: d.actorId.role,
        }
      : null,
  }));

  return NextResponse.json({
    ok: true,
    items,
    page,
    totalPages: Math.ceil(total / limit),
    total,
  });
}