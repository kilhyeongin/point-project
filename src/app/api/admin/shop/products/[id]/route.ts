import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { ShopProduct } from "@/models/ShopProduct";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();

    if (!session || !["ADMIN", "HOST"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { ok: false, error: "잘못된 상품 ID입니다." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updateFields: Record<string, unknown> = { updatedBy: session.username };

    if (body?.name !== undefined) updateFields.name = String(body.name).trim();
    if (body?.brand !== undefined) updateFields.brand = String(body.brand).trim();
    if (body?.description !== undefined) updateFields.description = String(body.description).trim();
    if (body?.pointCost !== undefined) updateFields.pointCost = Number(body.pointCost);
    if (body?.imageUrl !== undefined) updateFields.imageUrl = String(body.imageUrl).trim();
    if (body?.smartconProductCode !== undefined) updateFields.smartconProductCode = String(body.smartconProductCode).trim();
    if (body?.expirationDays !== undefined) updateFields.expirationDays = Number(body.expirationDays);
    if (body?.isActive !== undefined) updateFields.isActive = Boolean(body.isActive);
    if (body?.sortOrder !== undefined) updateFields.sortOrder = Number(body.sortOrder);

    await connectDB();

    const updated = await ShopProduct.findOneAndUpdate(
      { _id: id, organizationId: session.orgId ?? "4nwn" },
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "상품을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN_SHOP_PRODUCT_PUT_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "상품 수정 실패" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();

    if (!session || !["ADMIN", "HOST"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { ok: false, error: "잘못된 상품 ID입니다." },
        { status: 400 }
      );
    }

    await connectDB();

    const deleted = await ShopProduct.findOneAndDelete({
      _id: id,
      organizationId: session.orgId ?? "4nwn",
    });

    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "상품을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN_SHOP_PRODUCT_DELETE_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "상품 삭제 실패" },
      { status: 500 }
    );
  }
}
