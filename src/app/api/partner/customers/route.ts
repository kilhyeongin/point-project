// src/app/api/partner/customers/route.ts
// PARTNER: 나에게 신청(APPLIED)한 고객 목록 조회

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FavoritePartner } from "@/models/FavoritePartner";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, error: "제휴사만 접근할 수 있습니다." }, { status: 403 });
  }

  try {
    await connectDB();

    const orgId = session.orgId ?? "4nwn";

    const docs = await FavoritePartner.find(
      { organizationId: orgId, partnerId: session.uid, status: "APPLIED" },
      { customerId: 1, createdAt: 1, appliedAt: 1 }
    )
      .populate("customerId", "username name socialAccounts")
      .sort({ appliedAt: -1, createdAt: -1 })
      .limit(200)
      .lean();

    const items = (docs as any[]).map((d) => {
      const socialAccounts: { provider: string }[] = d.customerId?.socialAccounts ?? [];
      const socialProvider = socialAccounts.length > 0 ? socialAccounts[0].provider : null;
      return {
        id: String(d._id),
        customerId: String(d.customerId?._id ?? d.customerId),
        username: d.customerId?.username ?? "",
        name: d.customerId?.name ?? "",
        socialProvider,
        appliedAt: d.appliedAt ?? d.createdAt,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[PARTNER_CUSTOMERS_GET_ERROR]", error);
    return NextResponse.json({ ok: false, error: "고객 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
