import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { ShopProduct } from "@/models/ShopProduct";

export async function GET() {
  try {
    const session = await getSessionFromCookies();

    if (!session || !["ADMIN", "HOST"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    await connectDB();

    const docs = await ShopProduct.find({ organizationId: session.orgId ?? "4nwn" })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    const items = (docs as any[]).map((doc) => ({
      id: String(doc._id),
      name: String(doc.name ?? ""),
      brand: String(doc.brand ?? ""),
      description: String(doc.description ?? ""),
      pointCost: Number(doc.pointCost ?? 0),
      imageUrl: String(doc.imageUrl ?? ""),
      smartconProductCode: String(doc.smartconProductCode ?? ""),
      expirationDays: Number(doc.expirationDays ?? 90),
      isActive: Boolean(doc.isActive),
      sortOrder: Number(doc.sortOrder ?? 0),
      createdAt: doc.createdAt ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[ADMIN_SHOP_PRODUCTS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "상품 목록 조회 실패" },
      { status: 500 }
    );
  }
}

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
    const name = String(body?.name ?? "").trim();
    const brand = String(body?.brand ?? "").trim();
    const pointCost = Number(body?.pointCost ?? 0);

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "상품명을 입력하세요." },
        { status: 400 }
      );
    }
    if (!brand) {
      return NextResponse.json(
        { ok: false, error: "브랜드를 입력하세요." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(pointCost) || pointCost < 1) {
      return NextResponse.json(
        { ok: false, error: "포인트 금액은 1 이상이어야 합니다." },
        { status: 400 }
      );
    }

    await connectDB();

    const doc = await ShopProduct.create({
      organizationId: session.orgId ?? "4nwn",
      name,
      brand,
      description: String(body?.description ?? "").trim(),
      pointCost,
      imageUrl: String(body?.imageUrl ?? "").trim(),
      smartconProductCode: String(body?.smartconProductCode ?? "").trim(),
      expirationDays: Number(body?.expirationDays ?? 90),
      isActive: body?.isActive !== false,
      sortOrder: Number(body?.sortOrder ?? 0),
      createdBy: session.username,
      updatedBy: session.username,
    });

    return NextResponse.json({ ok: true, id: String(doc._id) }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_SHOP_PRODUCTS_POST_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "상품 등록 실패" },
      { status: 500 }
    );
  }
}
