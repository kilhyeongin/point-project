import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { ShopOrder } from "@/models/ShopOrder";
import { Ledger } from "@/models/Ledger";
import { creditWallet } from "@/services/wallet";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session || !["ADMIN", "HOST"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const status = searchParams.get("status") ?? "";
    const period = searchParams.get("period") ?? "today";
    const limit = 30;
    const skip = (page - 1) * limit;

    await connectDB();

    const orgId = session.orgId ?? "4nwn";
    const query: Record<string, unknown> = { organizationId: orgId };
    if (status) query.status = status;

    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";

    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from + "T00:00:00.000Z");
      if (to) range.$lte = new Date(to + "T23:59:59.999Z");
      query.createdAt = range;
    } else {
      const now = new Date();
      if (period === "today") {
        query.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
      } else if (period === "week") {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
        query.createdAt = { $gte: monday };
      } else if (period === "month") {
        query.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
      }
    }

    const [orders, total] = await Promise.all([
      ShopOrder.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "name username")
        .lean(),
      ShopOrder.countDocuments(query),
    ]);

    const items = (orders as any[]).map((doc) => ({
      id: String(doc._id),
      customerName: String(doc.customerId?.name ?? ""),
      customerUsername: String(doc.customerId?.username ?? ""),
      customerId: String(doc.customerId?._id ?? doc.customerId ?? ""),
      productName: String(doc.productSnapshot?.name ?? ""),
      productBrand: String(doc.productSnapshot?.brand ?? ""),
      pointsSpent: Number(doc.pointsSpent ?? 0),
      status: String(doc.status ?? ""),
      pinNumber: String(doc.pinNumber ?? ""),
      failReason: String(doc.failReason ?? ""),
      smartconRetryCount: Number(doc.smartconRetryCount ?? 0),
      expiresAt: doc.expiresAt ?? null,
      refundedAt: doc.refundedAt ?? null,
      createdAt: doc.createdAt ?? null,
    }));

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[ADMIN_SHOP_ORDERS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "주문 내역 조회 실패" },
      { status: 500 }
    );
  }
}

// 관리자 수동 환불 처리
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session || !["ADMIN", "HOST"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const orderId = String(body?.orderId ?? "").trim();

    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return NextResponse.json(
        { ok: false, error: "잘못된 주문 ID입니다." },
        { status: 400 }
      );
    }

    await connectDB();

    const orgId = session.orgId ?? "4nwn";
    const order = await ShopOrder.findOne({ _id: orderId, organizationId: orgId }).lean();

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const orderDoc = order as any;

    if (!["FAILED", "POINT_DEDUCTED", "SMARTCON_CALLED"].includes(orderDoc.status)) {
      return NextResponse.json(
        { ok: false, error: `${orderDoc.status} 상태는 환불할 수 없습니다.` },
        { status: 400 }
      );
    }

    if (orderDoc.refundLedgerId) {
      return NextResponse.json(
        { ok: false, error: "이미 환불된 주문입니다." },
        { status: 400 }
      );
    }

    const customerId = new mongoose.Types.ObjectId(String(orderDoc.customerId));
    const pointCost = Number(orderDoc.pointsSpent);

    const refundSession = await mongoose.startSession();
    try {
      await refundSession.withTransaction(async () => {
        await creditWallet(customerId, pointCost, refundSession);

        const [refundLedger] = await Ledger.create(
          [
            {
              organizationId: orgId,
              accountId: customerId,
              userId: customerId,
              actorId: new mongoose.Types.ObjectId(session.uid),
              type: "ADJUST",
              amount: pointCost,
              refType: "ShopOrder",
              refId: new mongoose.Types.ObjectId(orderId),
              note: `관리자 수동 환불: ${orderDoc.productSnapshot?.name ?? ""}`,
            },
          ],
          { session: refundSession }
        );

        await ShopOrder.updateOne(
          { _id: orderId },
          {
            $set: {
              status: "REFUNDED",
              refundLedgerId: refundLedger._id,
              refundedAt: new Date(),
            },
          },
          { session: refundSession }
        );
      });
    } finally {
      await refundSession.endSession();
    }

    return NextResponse.json({ ok: true, message: "환불이 완료되었습니다." });
  } catch (error) {
    console.error("[ADMIN_SHOP_ORDER_REFUND_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "환불 처리 실패" },
      { status: 500 }
    );
  }
}
