import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { ShopProduct } from "@/models/ShopProduct";

export async function GET() {
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

    await connectDB();

    const orgId = session.orgId ?? "4nwn";

    const docs = await ShopProduct.find(
      { organizationId: orgId, isActive: true },
      { smartconProductCode: 0, createdBy: 0, updatedBy: 0 }
    )
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    const items = (docs as any[]).map((doc) => ({
      id: String(doc._id),
      name: String(doc.name ?? ""),
      brand: String(doc.brand ?? ""),
      description: String(doc.description ?? ""),
      pointCost: Number(doc.pointCost ?? 0),
      imageUrl: String(doc.imageUrl ?? ""),
      expirationDays: Number(doc.expirationDays ?? 90),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[SHOP_PRODUCTS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "상품 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
