// src/app/api/admin/topup-requests/[id]/approve/route.ts
// =======================================================
// ADMIN: 충전 요청 승인
// -------------------------------------------------------
// ✔ TopupRequest PENDING -> APPROVED
// ✔ Wallet 적립
// ✔ Ledger TOPUP 기록
// ✔ 중복 승인 방지
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { TopupRequest } from "@/models/TopupRequest";
import { Ledger } from "@/models/Ledger";
import { creditWallet } from "@/services/wallet";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, message: "관리자만 승인할 수 있습니다." },
      { status: 403 }
    );
  }

  await connectDB();

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { ok: false, message: "요청 ID 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const topupId = new mongoose.Types.ObjectId(id);
  const adminId = new mongoose.Types.ObjectId(session.uid);

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const locked = await TopupRequest.findOneAndUpdate(
        { _id: topupId, status: "PENDING" },
        {
          $set: {
            status: "APPROVED",
            approvedById: adminId,
            decidedAt: new Date(),
          },
        },
        { new: true, session: dbSession }
      );

      if (!locked) {
        return {
          ok: false as const,
          message: "이미 처리되었거나 존재하지 않는 충전 요청입니다.",
        };
      }

      const amount = Math.abs(Number(locked.amount ?? 0));
      if (!amount || amount <= 0) {
        throw new Error("충전 금액이 올바르지 않습니다.");
      }

      await creditWallet(
        new mongoose.Types.ObjectId(String(locked.accountId)),
        amount,
        dbSession
      );

      const ledger = await Ledger.create(
        [
          {
            accountId: locked.accountId,
            actorId: adminId,
            type: "TOPUP",
            amount: +amount,
            refType: "TOPUP",
            refId: locked._id,
            note: locked.note ? `충전 승인 / ${locked.note}` : "충전 승인",
          },
        ],
        { session: dbSession }
      );

      locked.ledgerId = ledger[0]._id;
      await locked.save({ session: dbSession });

      return {
        ok: true as const,
        id: String(locked._id),
        ledgerId: String(ledger[0]._id),
      };
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: String(e?.message ?? "서버 오류") },
      { status: 500 }
    );
  } finally {
    dbSession.endSession();
  }
}