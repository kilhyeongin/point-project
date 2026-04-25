import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PointSettlementPayment } from "@/models/PointSettlementPayment";
import { WithdrawalRequest } from "@/models/WithdrawalRequest";
import { User } from "@/models/User";
import { getWalletBalance } from "@/services/wallet";

// GET: 내 포인트 정산 목록
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER")
    return NextResponse.json({ ok: false }, { status: 401 });

  try {
    await connectDB();
    const partnerId = new mongoose.Types.ObjectId(session.uid);
    const orgId = session.orgId ?? "4nwn";

    const items = await PointSettlementPayment.find({ organizationId: orgId, partnerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean() as any[];

    return NextResponse.json({
      ok: true,
      items: items.map((i) => ({
        id: String(i._id),
        year: i.year,
        month: i.month,
        amount: i.amount,
        note: i.note,
        status: i.status,
        confirmedAt: i.confirmedAt ?? null,
        cancelledAt: i.cancelledAt ?? null,
        createdAt: i.createdAt,
      })),
    });
  } catch (error) {
    console.error("[PARTNER_POINT_SETTLEMENTS_GET_ERROR]", error);
    return NextResponse.json({ ok: false, message: "정산 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

// POST: 포인트로 정산 신청
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER")
    return NextResponse.json({ ok: false }, { status: 401 });

  await connectDB();
  const partnerId = new mongoose.Types.ObjectId(session.uid);
  const orgId = session.orgId ?? "4nwn";

  const body = await req.json();
  const amount = Number(body?.amount ?? 0);
  const year = Number(body?.year ?? 0);
  const month = Number(body?.month ?? 0);
  const note = String(body?.note ?? "").trim().slice(0, 200);

  if (!Number.isFinite(amount) || amount < 1) {
    return NextResponse.json({ ok: false, message: "금액을 입력해주세요." }, { status: 400 });
  }
  if (!year || !month) {
    return NextResponse.json({ ok: false, message: "정산 연월을 선택해주세요." }, { status: 400 });
  }

  try {
    // 이미 PENDING 정산 있는지 확인
    const existingPending = await PointSettlementPayment.findOne({
      organizationId: orgId,
      partnerId,
      status: "PENDING",
    }).lean();

    if (existingPending) {
      return NextResponse.json(
        { ok: false, message: "이미 대기중인 정산 신청이 있습니다. 취소 후 다시 신청해주세요." },
        { status: 400 }
      );
    }

    // 가용 잔액 확인 (잔액 - PENDING 출금 - PENDING 포인트 정산)
    const [walletBalance, pendingWithdrawals, pendingSettlements] = await Promise.all([
      getWalletBalance(partnerId),
      WithdrawalRequest.aggregate([
        { $match: { organizationId: orgId, partnerId, status: "PENDING" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PointSettlementPayment.aggregate([
        { $match: { organizationId: orgId, partnerId, status: "PENDING" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const locked =
      Number(pendingWithdrawals[0]?.total ?? 0) +
      Number(pendingSettlements[0]?.total ?? 0);
    const available = walletBalance - locked;

    if (amount > available) {
      return NextResponse.json(
        { ok: false, message: `가용 포인트가 부족합니다. (가용: ${available.toLocaleString()}P)` },
        { status: 400 }
      );
    }

    const user = await User.findById(partnerId).lean() as any;
    const partnerName = user?.partnerProfile?.businessName || user?.name || "";

    const doc = await PointSettlementPayment.create({
      organizationId: orgId,
      partnerId,
      partnerName,
      year,
      month,
      amount,
      note,
      status: "PENDING",
    });

    return NextResponse.json({ ok: true, id: String(doc._id) }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { ok: false, message: "이미 대기중인 정산 신청이 있습니다. 취소 후 다시 신청해주세요." },
        { status: 400 }
      );
    }
    console.error("[PARTNER_POINT_SETTLEMENTS_POST_ERROR]", error);
    return NextResponse.json({ ok: false, message: "정산 신청 중 오류가 발생했습니다." }, { status: 500 });
  }
}
