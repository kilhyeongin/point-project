// src/app/api/admin/accounts/route.ts
// =======================================================
// ADMIN: 계정 잔액 조회 API (페이지네이션 지원)
// -------------------------------------------------------
// ✔ 관리자만 접근
// ✔ Wallet 기준 현재 잔액 계산
// ✔ PARTNER / CUSTOMER / ADMIN 반환
// ✔ page, limit, q, role 파라미터 지원
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getWalletBalancesMap } from "@/services/wallet";
import type { UserLeanDoc, UserFilter, UserRole } from "@/types/user";

const VALID_ROLES: UserRole[] = ["ADMIN", "PARTNER", "CUSTOMER", "HOST"];
const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
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

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const q = String(searchParams.get("q") ?? "").trim().slice(0, 100);
  const roleParam = String(searchParams.get("role") ?? "").toUpperCase() as UserRole;
  const skip = (page - 1) * PAGE_SIZE;

  const orgId = session.orgId ?? "4nwn";

  const filter: UserFilter = {
    organizationId: orgId,
    status: { $in: ["ACTIVE", "PENDING", "BLOCKED"] },
  };

  if (VALID_ROLES.includes(roleParam)) {
    filter.role = roleParam;
  }

  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { username: { $regex: escaped, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
    ];
  }

  await connectDB();

  const [users, total] = await Promise.all([
    User.find(filter, { username: 1, name: 1, role: 1, status: 1, createdAt: 1, socialAccounts: 1 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .lean() as Promise<UserLeanDoc[]>,
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => new mongoose.Types.ObjectId(String(u._id)));
  const balanceMap = await getWalletBalancesMap(userIds);

  const items = users.map((u: any) => ({
    id: String(u._id),
    username: u.username,
    name: u.name,
    role: u.role,
    status: u.status,
    balance: balanceMap.get(String(u._id)) ?? 0,
    socialProviders: Array.isArray(u.socialAccounts)
      ? u.socialAccounts.map((s: any) => s.provider)
      : [],
  }));

  return NextResponse.json({
    ok: true,
    items,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    total,
  });
}
