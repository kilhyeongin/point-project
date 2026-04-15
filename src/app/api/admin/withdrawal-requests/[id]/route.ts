import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { WithdrawalRequest } from "@/models/WithdrawalRequest";
import { debitWallet } from "@/services/wallet";
import { Ledger } from "@/models/Ledger";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH: 출금 확정 (PENDING → CONFIRMED + 포인트 차감)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ ok: false }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ ok: false, message: "잘못된 ID입니다." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const adminNote = String(body?.adminNote ?? "").trim();

  await connectDB();
  const orgId = session.orgId ?? "4nwn";
  const adminId = new mongoose.Types.ObjectId(session.uid);
  const dbSession = await mongoose.startSession();

  try {
    await dbSession.withTransaction(async () => {
      const doc = await WithdrawalRequest.findOne(
        { _id: id, organizationId: orgId, status: "PENDING" },
        null,
        { session: dbSession }
      );
      if (!doc) throw new Error("대기중인 요청을 찾을 수 없습니다.");

      const partnerId = new mongoose.Types.ObjectId(String(doc.partnerId));
      const amount = Number(doc.amount);

      // 제휴사 포인트 최종 차감
      await debitWallet(partnerId, amount, dbSession);

      // Ledger 기록
      await Ledger.create(
        [{
          organizationId: orgId,
          accountId: partnerId,
          userId: partnerId,
          actorId: adminId,
          type: "ADJUST",
          amount: -amount,
          refType: "WITHDRAWAL_REQUEST",
          refId: doc._id,
          note: `포인트 출금 확정${adminNote ? ` - ${adminNote}` : ""}`,
        }],
        { session: dbSession }
      );

      doc.status = "CONFIRMED";
      doc.confirmedAt = new Date();
      if (adminNote) doc.adminNote = adminNote;
      await doc.save({ session: dbSession });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message ?? "서버 오류" }, { status: 400 });
  } finally {
    dbSession.endSession();
  }
}
