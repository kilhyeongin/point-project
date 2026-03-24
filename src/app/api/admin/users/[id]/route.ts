import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getWalletBalancesMap } from "@/services/wallet";
import mongoose from "mongoose";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "관리자만 접근 가능합니다." }, { status: 403 });
  }

  const { id } = await params;

  await connectDB();

  const user = await User.findById(id, {
    username: 1,
    name: 1,
    email: 1,
    role: 1,
    status: 1,
    createdAt: 1,
    customerProfile: 1,
    partnerProfile: 1,
  }).lean();

  if (!user) {
    return NextResponse.json({ ok: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const balanceMap = await getWalletBalancesMap([new mongoose.Types.ObjectId(id)]);

  const u = user as any;
  return NextResponse.json({
    ok: true,
    user: {
      id: String(u._id),
      username: u.username,
      name: u.name,
      email: u.email ?? "",
      role: u.role,
      status: u.status,
      balance: balanceMap.get(id) ?? 0,
      createdAt: u.createdAt,
      customerProfile: u.customerProfile ?? null,
      partnerProfile: u.partnerProfile ?? null,
    },
  });
}
