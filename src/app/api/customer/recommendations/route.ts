import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";
import {
  normalizeCategoryCodes,
  getPartnerCategoryMap,
  normalizeCategoryCode,
  DEFAULT_PARTNER_CATEGORY_SEEDS,
} from "@/lib/partnerCategories";

const LEGACY_MAP = Object.fromEntries(
  DEFAULT_PARTNER_CATEGORY_SEEDS.map((s) => [s.name, s.code])
);

function resolveLabels(codes: string[], catMap: Map<string, string>) {
  return codes.map((code) => catMap.get(code) ?? code);
}

function resolveCodesSync(
  values: unknown,
  legacyCategory: unknown,
  allowed: Set<string>
): string[] {
  const set = new Set<string>();
  const append = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return;
    const mapped = LEGACY_MAP[raw] || normalizeCategoryCode(raw);
    if (mapped && allowed.has(mapped)) set.add(mapped);
  };
  if (Array.isArray(values)) values.forEach(append);
  append(legacyCategory);
  return Array.from(set);
}

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

    const me = await User.findById(
      session.uid,
      {
        customerProfile: 1,
      }
    ).lean();

    if (!me) {
      return NextResponse.json(
        { ok: false, error: "고객 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 카테고리 마스터 한 번만 로드
    const [catMap, myInterests] = await Promise.all([
      getPartnerCategoryMap(),
      normalizeCategoryCodes(
        (me as any)?.customerProfile?.interests ?? [],
        undefined,
        { onlyActive: true, visibleToCustomerOnly: true }
      ),
    ]);
    const allowedCodes = new Set(catMap.keys());

    const [partnerDocs, favoriteDocs] = await Promise.all([
      User.find(
        {
          role: "PARTNER",
          status: "ACTIVE",
          "partnerProfile.isPublished": true,
        },
        {
          username: 1,
          name: 1,
          partnerProfile: 1,
        }
      )
        .sort({ createdAt: -1 })
        .lean(),
      FavoritePartner.find(
        { customerId: session.uid, likedByCustomer: true },
        { partnerId: 1 }
      ).lean(),
    ]);

    const favoriteSet = new Set(
      (favoriteDocs as any[]).map((f) => String(f.partnerId))
    );

    const scoredItems = [];

    for (const doc of partnerDocs as any[]) {
      const profile = doc.partnerProfile ?? {};

      // 루프 안에서 DB 조회 없이 동기 처리
      const categoryCodes = resolveCodesSync(
        profile.categories,
        profile.category,
        allowedCodes
      );

      const matchCount = categoryCodes.filter((code) =>
        myInterests.includes(code)
      ).length;

      if (myInterests.length > 0 && matchCount === 0) {
        continue;
      }

      const categoryLabels = resolveLabels(categoryCodes, catMap);

      scoredItems.push({
        id: String(doc._id),
        username: String(doc.username ?? ""),
        name: String(doc.name ?? ""),
        category: categoryCodes[0] ?? "",
        categories: categoryCodes,
        categoryLabels,
        intro: String(profile.intro ?? ""),
        benefitText: String(profile.benefitText ?? ""),
        address: String(profile.address ?? ""),
        detailAddress: String(profile.detailAddress ?? ""),
        phone: String(profile.phone ?? ""),
        applyUrl: String(profile.applyUrl ?? ""),
        kakaoChannelUrl: String(profile.kakaoChannelUrl ?? ""),
        coverImageUrl: String(profile.coverImageUrl ?? ""),
        isFavorite: favoriteSet.has(String(doc._id)),
        score: matchCount,
      });
    }

    scoredItems.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      ok: true,
      items: scoredItems.slice(0, 12),
      interests: myInterests,
    });
  } catch (error) {
    console.error("[CUSTOMER_RECOMMENDATIONS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "추천 제휴사를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}