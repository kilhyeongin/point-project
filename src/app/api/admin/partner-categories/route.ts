import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PartnerCategoryMaster } from "@/models/PartnerCategory";
import {
  getPartnerCategoryMasters,
  normalizeCategoryCode,
} from "@/lib/partnerCategories";

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

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const orders: { id: string; sortOrder: number }[] = Array.isArray(body?.orders)
      ? body.orders
      : [];

    if (orders.length === 0) {
      return NextResponse.json({ ok: false, error: "순서 데이터가 없습니다." }, { status: 400 });
    }

    await connectDB();

    await Promise.all(
      orders.map(({ id, sortOrder }) =>
        PartnerCategoryMaster.findByIdAndUpdate(id, { $set: { sortOrder } })
      )
    );

    const items = await getPartnerCategoryMasters();
    return NextResponse.json({ ok: true, message: "순서가 저장되었습니다.", items });
  } catch (error) {
    console.error("[ADMIN_PARTNER_CATEGORIES_PATCH_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "순서를 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    await connectDB();
    const items = await getPartnerCategoryMasters();
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[ADMIN_PARTNER_CATEGORIES_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "카테고리 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();

    const code = normalizeCategoryCode(body?.code);
    const name = toText(body?.name, 50);
    const description = toText(body?.description, 200);
    const sortOrder = toSortOrder(body?.sortOrder);

    const isActive =
      body?.isActive === undefined ? true : toBool(body?.isActive);
    const isVisibleToPartner =
      body?.isVisibleToPartner === undefined ? true : toBool(body?.isVisibleToPartner);
    const isVisibleToCustomer =
      body?.isVisibleToCustomer === undefined ? true : toBool(body?.isVisibleToCustomer);

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

    const exists = await PartnerCategoryMaster.findOne({ code }, { _id: 1 }).lean();
    if (exists) {
      return NextResponse.json(
        { ok: false, error: "이미 존재하는 카테고리 코드입니다." },
        { status: 409 }
      );
    }

    await PartnerCategoryMaster.create({
      code,
      name,
      description,
      sortOrder,
      isActive,
      isVisibleToPartner,
      isVisibleToCustomer,
      createdBy: auth.session!.username,
      updatedBy: auth.session!.username,
    });

    const items = await getPartnerCategoryMasters();

    return NextResponse.json({
      ok: true,
      message: "카테고리가 등록되었습니다.",
      items,
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_CATEGORIES_POST_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "카테고리를 등록하지 못했습니다." },
      { status: 500 }
    );
  }
}