import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { WithdrawalRequest } from "@/models/WithdrawalRequest";
import { User } from "@/models/User";
import { getWalletBalance } from "@/services/wallet";

const MIN_AMOUNT = 500_000;
const STEP = 50_000;

// GET: 내 출금 요청 목록
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER")
    return NextResponse.json({ ok: false }, { status: 401 });

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(session.uid);
  const orgId = session.orgId ?? "4nwn";

  const items = await WithdrawalRequest.find({ organizationId: orgId, partnerId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean() as any[];

  return NextResponse.json({
    ok: true,
    items: items.map((i) => ({
      id: String(i._id),
      amount: i.amount,
      status: i.status,
      adminNote: i.adminNote,
      confirmedAt: i.confirmedAt ?? null,
      cancelledAt: i.cancelledAt ?? null,
      createdAt: i.createdAt,
    })),
  });
}

// POST: 출금 신청
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER")
    return NextResponse.json({ ok: false }, { status: 401 });

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(session.uid);
  const orgId = session.orgId ?? "4nwn";

  // 이미 PENDING 출금 있는지 확인
  const existing = await WithdrawalRequest.findOne({
    organizationId: orgId,
    partnerId,
    status: "PENDING",
  }).lean();

  if (existing) {
    return NextResponse.json(
      { ok: false, message: "이미 대기중인 출금 신청이 있습니다. 취소 후 다시 신청해주세요." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const amount = Number(body?.amount ?? 0);

  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return NextResponse.json(
      { ok: false, message: `최소 출금 금액은 ${MIN_AMOUNT.toLocaleString()}P 입니다.` },
      { status: 400 }
    );
  }
  if ((amount - MIN_AMOUNT) % STEP !== 0) {
    return NextResponse.json(
      { ok: false, message: `${STEP.toLocaleString()}P 단위로만 출금 신청 가능합니다.` },
      { status: 400 }
    );
  }

  // 가용 잔액 확인 (잔액 - PENDING 포인트 정산 금액)
  const { PointSettlementPayment } = await import("@/models/PointSettlementPayment");
  const [walletBalance, pendingSettlements] = await Promise.all([
    getWalletBalance(partnerId),
    PointSettlementPayment.aggregate([
      { $match: { organizationId: orgId, partnerId, status: "PENDING" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const lockedBySettlement = Number(pendingSettlements[0]?.total ?? 0);
  const available = walletBalance - lockedBySettlement;

  if (amount > available) {
    return NextResponse.json(
      { ok: false, message: `가용 포인트가 부족합니다. (가용: ${available.toLocaleString()}P)` },
      { status: 400 }
    );
  }

  const user = await User.findById(partnerId).lean() as any;
  const partnerName = user?.partnerProfile?.businessName || user?.name || "";

  const doc = await WithdrawalRequest.create({
    organizationId: orgId,
    partnerId,
    partnerName,
    amount,
    status: "PENDING",
  });

  return NextResponse.json({ ok: true, id: String(doc._id) }, { status: 201 });
}
