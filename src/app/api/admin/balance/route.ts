// src/app/api/admin/balance/route.ts
// =======================================================
// ADMIN: 특정 사용자 현재 잔액 조회
// -------------------------------------------------------
// ✔ Wallet 기준 현재 잔액 조회
// ✔ Wallet 없으면 기존 Ledger 합산으로 자동 초기화
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getAccountBalance } from "@/services/balance";

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

  const { searchParams } = new URL(req.url);
  const userId = String(searchParams.get("userId") ?? "").trim();

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json(
      { ok: false, message: "유효한 userId가 필요합니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const oid = new mongoose.Types.ObjectId(userId);

  const user = await User.findById(oid, {
    _id: 1,
    username: 1,
    name: 1,
    role: 1,
    status: 1,
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "사용자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const balance = await getAccountBalance(oid);

  return NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
    },
    balance: Number(balance),
  });
}