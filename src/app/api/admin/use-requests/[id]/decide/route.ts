// src/app/api/admin/use-requests/[id]/decide/route.ts
// =======================================================
// ADMIN: 차감요청 승인/거절
// -------------------------------------------------------
// ✔ 승인 시 customer Wallet 원자 차감
// ✔ 승인 시 partner Wallet 원자 적립
// ✔ Ledger는 이력 기록용
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UseRequest } from "@/models/UseRequest";
import { Ledger } from "@/models/Ledger";
import { debitWallet, creditWallet } from "@/services/wallet";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
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

  const { id } = await params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body?.action ?? "").toUpperCase();
  const adminNote = String(body?.note ?? "").trim();

  if (!["APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json(
      { ok: false, message: "action은 APPROVE 또는 REJECT 여야 합니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const orgId = session.orgId ?? "4nwn";
  const _id = new mongoose.Types.ObjectId(id);
  const adminId = new mongoose.Types.ObjectId(session.uid);

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const locked = await UseRequest.findOneAndUpdate(
        { _id, organizationId: orgId, status: "PENDING" },
        { $set: { decidedAt: new Date(), adminId } },
        { returnDocument: "after", session: dbSession }
      );

      if (!locked) {
        return { ok: false as const, message: "이미 처리된 요청입니다." };
      }

      if (action === "REJECT") {
        const nextNote = adminNote
          ? locked.note
            ? `${locked.note} / ADMIN: ${adminNote}`
            : `ADMIN: ${adminNote}`
          : locked.note;

        locked.status = "REJECTED";
        locked.note = nextNote;
        await locked.save({ session: dbSession });

        return { ok: true as const, status: locked.status };
      }

      const amount = Math.abs(Number(locked.amount || 0));
      if (!amount || amount <= 0) {
        throw new Error("요청 금액이 올바르지 않습니다.");
      }

      const customerAccountId = new mongoose.Types.ObjectId(String(locked.userId));
      const partnerAccountId = new mongoose.Types.ObjectId(String(locked.partnerId));

      // 1) 고객 포인트 차감
      const debit = await debitWallet(customerAccountId, amount, dbSession);

      // 2) 제휴사 포인트 적립 (고객이 사용한 포인트 그대로 이동)
      await creditWallet(partnerAccountId, amount, dbSession);

      const baseNote = locked.note
        ? `${locked.note} / ADMIN 승인(차감)`
        : "ADMIN 승인(차감)";
      const finalNote = adminNote ? `${baseNote} / ADMIN: ${adminNote}` : baseNote;

      // 3) Ledger: 고객 차감 + 제휴사 적립 각 1행
      const created = await Ledger.create(
        [
          {
            // 고객 차감
            organizationId: orgId,
            accountId: customerAccountId,
            userId: customerAccountId,
            actorId: adminId,
            counterpartyId: partnerAccountId,
            type: "USE",
            amount: -amount,
            refType: "USE_REQUEST",
            refId: locked._id,
            note: `사용(차감) - ${finalNote}`,
          },
          {
            // 제휴사 적립
            organizationId: orgId,
            accountId: partnerAccountId,
            userId: partnerAccountId,
            actorId: adminId,
            counterpartyId: customerAccountId,
            type: "USE",
            amount: +amount,
            refType: "USE_REQUEST",
            refId: locked._id,
            note: `고객 포인트 수신 - ${finalNote}`,
          },
        ],
        { session: dbSession, ordered: true }
      );

      const customerLedger = created[0];
      const customerLedgerId = (customerLedger as any)._id as mongoose.Types.ObjectId;

      locked.status = "APPROVED";
      locked.ledgerId = customerLedgerId;
      locked.note = adminNote
        ? locked.note
          ? `${locked.note} / ADMIN: ${adminNote}`
          : `ADMIN: ${adminNote}`
        : locked.note;

      await locked.save({ session: dbSession });

      return {
        ok: true as const,
        status: locked.status,
        ledgerId: String(customerLedgerId),
        balanceBefore: debit.balanceBefore,
        balanceAfter: debit.balanceAfter,
      };
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (e: any) {
    const msg = String(e?.message ?? "서버 오류");
    if (msg.startsWith("잔액 부족:")) {
      return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}