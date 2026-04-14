import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";
import {
  normalizeCategoryCode,
  getPartnerCategoryMasters,
  DEFAULT_PARTNER_CATEGORY_SEEDS,
} from "@/lib/partnerCategories";

function textIncludes(source: unknown, keyword: string) {
  return String(source ?? "").toLowerCase().includes(keyword.toLowerCase());
}

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
    const keyword = String(searchParams.get("q") ?? "").trim();
    const category = String(searchParams.get("category") ?? "").trim();

    await connectDB();

    const orgId = session.orgId ?? "4nwn";

    const [docs, favoriteDocs] = await Promise.all([
      User.find(
        {
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
      )
        .sort({ createdAt: -1 })
        .lean(),
      FavoritePartner.find(
        { organizationId: orgId, customerId: session.uid, likedByCustomer: true },
        { partnerId: 1 }
      ).lean(),
    ]);

    const favoriteSet = new Set(
      (favoriteDocs as any[]).map((f) => String(f.partnerId))
    );

    // 카테고리 전체를 한 번만 로드 (N+1 방지)
    const allCategoryMasters = await getPartnerCategoryMasters({
      activeOnly: true,
      visibleToCustomerOnly: true,
      orgId: session.orgId ?? "4nwn",
    });
    const codeToLabel = new Map<string, string>();
    const legacyLabelToCode = new Map<string, string>();
    for (const item of allCategoryMasters) {
      codeToLabel.set(item.code, item.name);
      legacyLabelToCode.set(item.name, item.code);
    }
    for (const item of DEFAULT_PARTNER_CATEGORY_SEEDS) {
      if (!codeToLabel.has(item.code)) codeToLabel.set(item.code, item.name);
      if (!legacyLabelToCode.has(item.name)) legacyLabelToCode.set(item.name, item.code);
    }
    const allowedCodes = new Set(codeToLabel.keys());

    function resolveCategories(categories: unknown[], legacyCategory?: unknown): string[] {
      const set = new Set<string>();
      const append = (value: unknown) => {
        const raw = String(value ?? "").trim();
        if (!raw) return;
        const mapped = legacyLabelToCode.get(raw) ?? normalizeCategoryCode(raw);
        if (mapped && allowedCodes.has(mapped)) set.add(mapped);
      };
      for (const v of categories) append(v);
      if (legacyCategory) append(legacyCategory);
      return Array.from(set);
    }

    // 필터 카테고리 정규화
    const normalizedFilterCategories = category
      ? resolveCategories([category])
      : [];

    const items = [];

    for (const doc of docs as any[]) {
      const profile = doc.partnerProfile ?? {};
      const categoryCodes = resolveCategories(
        Array.isArray(profile.categories) ? profile.categories : [],
        profile.category
      );

      if (
        normalizedFilterCategories.length > 0 &&
        !categoryCodes.some((code) => normalizedFilterCategories.includes(code))
      ) {
        continue;
      }

      const categoryLabels = categoryCodes.map((code) => codeToLabel.get(code) ?? code);

      const searchable = [
        doc.name,
        doc.username,
        profile.intro,
        profile.benefitText,
        profile.address,
        ...categoryLabels,
      ];

      if (
        keyword &&
        !searchable.some((value) => textIncludes(value, keyword))
      ) {
        continue;
      }

      items.push({
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
      });
    }

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error("[CUSTOMER_PARTNERS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "제휴사 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}