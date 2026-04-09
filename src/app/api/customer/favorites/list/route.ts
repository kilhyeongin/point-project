// src/app/api/customer/favorites/list/route.ts
// =======================================================
// CUSTOMER: 관심업체 상세 목록 조회
// =======================================================

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FavoritePartner } from "@/models/FavoritePartner";
import { User } from "@/models/User";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "CUSTOMER") {
    return NextResponse.json(
      { ok: false, message: "고객만 접근 가능합니다." },
      { status: 403 }
    );
  }

  await connectDB();

  const orgId = session.orgId ?? "default";

  const favorites = await FavoritePartner.find(
    { organizationId: orgId, customerId: session.uid, likedByCustomer: true },
    { partnerId: 1, createdAt: 1, status: 1, appliedAt: 1 }
  )
    .sort({ createdAt: -1 })
    .lean();

  const partnerIds = favorites.map((f: any) => f.partnerId);

  if (partnerIds.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const partnerDocs = await User.find(
    {
      _id: { $in: partnerIds },
      organizationId: orgId,
      role: "PARTNER",
      status: "ACTIVE",
      "partnerProfile.isPublished": true,
    },
    {
      username: 1,
      name: 1,
      partnerProfile: 1,
    }
  ).lean();

  const partnerMap = new Map<string, any>();
  for (const doc of partnerDocs as any[]) {
    partnerMap.set(String(doc._id), doc);
  }

  const items = favorites
    .map((fav: any) => {
      const doc = partnerMap.get(String(fav.partnerId));
      if (!doc) return null;

      const profile = doc.partnerProfile ?? {};

      return {
        id: String(doc._id),
        username: String(doc.username ?? ""),
        name: String(doc.name ?? ""),
        category: String(profile.category ?? "").trim() || "기타",
        intro: String(profile.intro ?? "").trim(),
        benefitText: String(profile.benefitText ?? "").trim(),
        kakaoChannelUrl: String(profile.kakaoChannelUrl ?? "").trim(),
        applyUrl: String(profile.applyUrl ?? "").trim(),
        address: String(profile.address ?? "").trim(),
        detailAddress: String(profile.detailAddress ?? "").trim(),
        phone: String(profile.phone ?? "").trim(),
        coverImageUrl: String(profile.coverImageUrl ?? "").trim(),
        favoritedAt: fav.createdAt,
        relationStatus: String(fav.status ?? "LIKED"),
        appliedAt: fav.appliedAt ?? null,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ ok: true, items });
}
