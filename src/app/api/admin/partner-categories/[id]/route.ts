import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PartnerCategoryMaster } from "@/models/PartnerCategory";
import { getPartnerCategoryMasters, normalizeCategoryCode } from "@/lib/partnerCategories";

function toText(value: unknown, max = 50) {
  return String(value ?? "").trim().slice(0, max);
}

function toBool(value: unknown) {
  return value === true;
}

function toSortOrder(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

async function requireAdmin() {
  const session = await getSessionFromCookies();

  if (!session) {
    return {
      error: NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  if (session.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { ok: false, error: "관리자만 접근할 수 있습니다." },
        { status: 403 }
      ),
    };
  }

  return { session };
}

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: NextRequest, { params }: Context) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;

    await connectDB();

    const deleted = await PartnerCategoryMaster.findByIdAndDelete(id).lean();

    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const items = await getPartnerCategoryMasters();

    return NextResponse.json({
      ok: true,
      message: "카테고리가 삭제되었습니다.",
      items,
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_CATEGORIES_DELETE_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "카테고리를 삭제하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const code = normalizeCategoryCode(body?.code);
    const name = toText(body?.name, 50);
    const description = toText(body?.description, 200);
    const sortOrder = toSortOrder(body?.sortOrder);
    const isActive = toBool(body?.isActive);
    const isVisibleToPartner = toBool(body?.isVisibleToPartner);
    const isVisibleToCustomer = toBool(body?.isVisibleToCustomer);

    if (!code) {
      return NextResponse.json(
        { ok: false, error: "카테고리 코드를 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "카테고리명을 입력해 주세요." },
        { status: 400 }
      );
    }

    await connectDB();

    const duplicate = await PartnerCategoryMaster.findOne(
      { code, _id: { $ne: id } },
      { _id: 1 }
    ).lean();

    if (duplicate) {
      return NextResponse.json(
        { ok: false, error: "이미 존재하는 카테고리 코드입니다." },
        { status: 409 }
      );
    }

    const updated = await PartnerCategoryMaster.findByIdAndUpdate(
      id,
      {
        $set: {
          code,
          name,
          description,
          sortOrder,
          isActive,
          isVisibleToPartner,
          isVisibleToCustomer,
          updatedBy: auth.session!.username,
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const items = await getPartnerCategoryMasters();

    return NextResponse.json({
      ok: true,
      message: "카테고리가 수정되었습니다.",
      items,
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_CATEGORIES_PUT_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "카테고리를 수정하지 못했습니다." },
      { status: 500 }
    );
  }
}