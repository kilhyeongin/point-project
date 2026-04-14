// src/app/api/admin/users/search/route.ts
// =======================================================
// ADMIN: 사용자 검색
// -------------------------------------------------------
// role=CHARGEABLE 이면 PARTNER만 조회
// 각 사용자 현재 잔액(balance)도 함께 반환
// - 현재 잔액은 Wallet 기준
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getWalletBalancesMap } from "@/services/wallet";

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
  const role = String(searchParams.get("role") ?? "ALL").toUpperCase();
  const orgId = session.orgId ?? "4nwn";

  const filter: any = { organizationId: orgId };

  if (role === "CHARGEABLE") {
    filter.role = "PARTNER";
  } else if (["CUSTOMER", "PARTNER", "ADMIN"].includes(role)) {
    filter.role = role;
  }

  if (q) {
    filter.$or = [
      { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\$&"), $options: "i" } },
      { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\$&"), $options: "i" } },
    ];
  }

  const users = await User.find(
    filter,
    { username: 1, name: 1, role: 1, status: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(100);

  const ids = users.map(
    (u: any) => new mongoose.Types.ObjectId(String(u._id))
  );

  const balanceMap = await getWalletBalancesMap(ids);

  return NextResponse.json({
    ok: true,
    items: users.map((u: any) => ({
      id: String(u._id),
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      balance: balanceMap.get(String(u._id)) ?? 0,
    })),
  });
}