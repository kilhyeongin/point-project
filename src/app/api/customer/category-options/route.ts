import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getPartnerCategoryMasters } from "@/lib/partnerCategories";

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

    const items = await getPartnerCategoryMasters({
      activeOnly: true,
      visibleToCustomerOnly: true,
      orgId: session.orgId ?? "4nwn",
    });

    return NextResponse.json({
      ok: true,
      items: items.map(({ id, ...rest }) => rest),
    });
  } catch (error) {
    console.error("[CUSTOMER_CATEGORY_OPTIONS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "카테고리 옵션을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}