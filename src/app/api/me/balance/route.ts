// src/app/api/me/balance/route.ts
// =======================================================
// 로그인 사용자 현재 포인트 잔액 조회
// -------------------------------------------------------
// ✔ 로그인 필수
// ✔ Wallet.balance 기준 조회
// ✔ Wallet 없으면 기존 Ledger 합산으로 자동 초기화
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getAccountBalance } from "@/services/balance";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    await connectDB();
    const accountId = new mongoose.Types.ObjectId(session.uid);
    const balance = await getAccountBalance(accountId);
    return NextResponse.json({ ok: true, balance: Number(balance) });
  } catch (error) {
    console.error("[ME_BALANCE_GET_ERROR]", error);
    return NextResponse.json({ ok: false, message: "잔액 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}