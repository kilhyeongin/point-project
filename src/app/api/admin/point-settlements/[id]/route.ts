import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PointSettlementPayment } from "@/models/PointSettlementPayment";
import { User } from "@/models/User";
import { debitWallet, creditWallet } from "@/services/wallet";
import { Ledger } from "@/models/Ledger";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH: 포인트 정산 확정 (제휴사 차감 → 관리자 적립)
export async function PATCH(_req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ ok: false }, { status: 403 });

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

      // 관리자 계정 찾기 (조직의 ADMIN 1명)
      const adminUser = await User.findOne(
        { organizationId: orgId, role: "ADMIN" },
        { _id: 1 },
        { session: dbSession }
      ).lean() as any;
      if (!adminUser) throw new Error("관리자 계정을 찾을 수 없습니다.");
      const adminUserId = new mongoose.Types.ObjectId(String(adminUser._id));

      // 제휴사 포인트 차감
      await debitWallet(partnerId, amount, dbSession);
      // 관리자 포인트 적립
      await creditWallet(adminUserId, amount, dbSession);

      // Ledger: 제휴사 차감 + 관리자 적립
      const noteText = `포인트 정산 확정 (${doc.year}년 ${doc.month}월${doc.note ? ` - ${doc.note}` : ""})`;
      const [partnerEntry, adminEntry] = await Ledger.create(
        [
          {
            organizationId: orgId,
            accountId: partnerId,
            userId: partnerId,
            actorId: adminId,
            counterpartyId: adminUserId,
            type: "ADJUST",
            amount: -amount,
            refType: "POINT_SETTLEMENT",
            refId: doc._id,
            note: `(출금) ${noteText}`,
          },
          {
            organizationId: orgId,
            accountId: adminUserId,
            userId: adminUserId,
            actorId: adminId,
            counterpartyId: partnerId,
            type: "ADJUST",
            amount: +amount,
            refType: "POINT_SETTLEMENT",
            refId: doc._id,
            note: `(수신) ${noteText}`,
          },
        ],
        { session: dbSession }
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
