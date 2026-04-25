import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PointSettlementPayment } from "@/models/PointSettlementPayment";
import { debitWallet, creditWallet } from "@/services/wallet";
import { Ledger } from "@/models/Ledger";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE: 포인트 정산 거절 (PENDING → CANCELLED, 관리자)
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ ok: false, message: "관리자만 접근할 수 있습니다." }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ ok: false, message: "잘못된 ID입니다." }, { status: 400 });

  try {
    await connectDB();
    const orgId = session.orgId ?? "4nwn";

    const doc = await PointSettlementPayment.findOneAndUpdate(
      { _id: id, organizationId: orgId, status: "PENDING" },
      { $set: { status: "CANCELLED", cancelledAt: new Date() } },
      { new: true }
    );

    if (!doc) {
      const exists = await PointSettlementPayment.findOne({ _id: id, organizationId: orgId }, { status: 1 }).lean();
      if (!exists) return NextResponse.json({ ok: false, message: "요청을 찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json({ ok: false, message: "대기중인 요청만 거절할 수 있습니다." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN_POINT_SETTLEMENT_DELETE_ERROR]", error);
    return NextResponse.json({ ok: false, message: "정산 거절 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// PATCH: 포인트 정산 확정 (제휴사 차감 → 관리자 적립)
export async function PATCH(_req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ ok: false, message: "관리자만 접근할 수 있습니다." }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ ok: false, message: "잘못된 ID입니다." }, { status: 400 });

  await connectDB();
  const orgId = session.orgId ?? "4nwn";
  const adminId = new mongoose.Types.ObjectId(session.uid);
  const dbSession = await mongoose.startSession();

  try {
    await dbSession.withTransaction(async () => {
      const doc = await PointSettlementPayment.findOne(
        { _id: id, organizationId: orgId, status: "PENDING" },
        null,
        { session: dbSession }
      );
      if (!doc) throw new Error("대기중인 요청을 찾을 수 없습니다.");

      const partnerId = new mongoose.Types.ObjectId(String(doc.partnerId));
      const amount = Number(doc.amount);

      // 제휴사 포인트 차감
      await debitWallet(partnerId, amount, dbSession);
      // 정산을 승인한 관리자 계정에 포인트 적립
      await creditWallet(adminId, amount, dbSession);

      // Ledger: 제휴사 차감 + 관리자 적립
      const noteText = `포인트 정산 확정 (${doc.year}년 ${doc.month}월${doc.note ? ` - ${doc.note}` : ""})`;
      const [partnerEntry, adminEntry] = await Ledger.create(
        [
          {
            organizationId: orgId,
            accountId: partnerId,
            userId: partnerId,
            actorId: adminId,
            counterpartyId: adminId,
            type: "ADJUST",
            amount: -amount,
            refType: "POINT_SETTLEMENT",
            refId: doc._id,
            note: `(출금) ${noteText}`,
          },
          {
            organizationId: orgId,
            accountId: adminId,
            userId: adminId,
            actorId: adminId,
            counterpartyId: partnerId,
            type: "ADJUST",
            amount: +amount,
            refType: "POINT_SETTLEMENT",
            refId: doc._id,
            note: `(수신) ${noteText}`,
          },
        ],
        { session: dbSession, ordered: true }
      ) as any[];

      doc.status = "CONFIRMED";
      doc.confirmedAt = new Date();
      doc.partnerLedgerId = partnerEntry._id;
      doc.adminLedgerId = adminEntry._id;
      await doc.save({ session: dbSession });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message ?? "서버 오류" }, { status: 400 });
  } finally {
    dbSession.endSession();
  }
}
