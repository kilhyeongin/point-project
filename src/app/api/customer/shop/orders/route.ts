import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { ShopOrder } from "@/models/ShopOrder";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (session.role !== "CUSTOMER") {
      return NextResponse.json(
        { ok: false, error: "고객만 접근할 수 있습니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = 20;
    const skip = (page - 1) * limit;

    await connectDB();

    const orgId = session.orgId ?? "4nwn";

    const customerId = new mongoose.Types.ObjectId(session.uid);

    const [orders, total] = await Promise.all([
      ShopOrder.find(
        { organizationId: orgId, customerId },
        { smartconOrderId: 0, smartconRetryCount: 0, smartconLastTriedAt: 0 }
      )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ShopOrder.countDocuments({ organizationId: orgId, customerId }),
    ]);

    const items = (orders as any[]).map((doc) => ({
      id: String(doc._id),
      productName: String(doc.productSnapshot?.name ?? ""),
      productBrand: String(doc.productSnapshot?.brand ?? ""),
      pointsSpent: Number(doc.pointsSpent ?? 0),
      status: String(doc.status ?? ""),
      pinNumber: ["COMPLETED"].includes(doc.status) ? String(doc.pinNumber ?? "") : "",
      pinUrl: ["COMPLETED"].includes(doc.status) ? String(doc.pinUrl ?? "") : "",
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
    console.error("[SHOP_ORDERS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "구매 내역을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
