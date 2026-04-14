import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";
import { normalizeCategoryCodes } from "@/lib/partnerCategories";

function text(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizePhone(value: unknown) {
  return String(value ?? "")
    .replace(/[^\d\-+\s()]/g, "")
    .trim()
    .slice(0, 50);
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeUrl(raw: unknown) {
  const value = String(raw ?? "").trim();

  if (!value) return "";

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
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

    if (session.role !== "PARTNER") {
      return NextResponse.json(
        { ok: false, error: "제휴사 계정만 접근할 수 있습니다." },
        { status: 403 }
      );
    }

    await connectDB();

    const me = await User.findOne(
      { _id: session.uid, organizationId: session.orgId ?? "default" },
      {
        username: 1,
        name: 1,
        partnerProfile: 1,
      }
    ).lean();

    if (!me) {
      return NextResponse.json(
        { ok: false, error: "계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const profile = (me as any).partnerProfile ?? {};

    const categories = await normalizeCategoryCodes(
      profile.categories,
      profile.category,
      { orgId: session.orgId ?? "default" }
    );

    return NextResponse.json({
      ok: true,
      item: {
        username: String((me as any).username ?? ""),
        name: String((me as any).name ?? ""),
        category: String(profile.category ?? ""),
        categories,
        intro: String(profile.intro ?? ""),
        benefitText: String(profile.benefitText ?? ""),
        address: String(profile.address ?? ""),
        detailAddress: String(profile.detailAddress ?? ""),
        phone: String(profile.phone ?? ""),
        contactEmail: String(profile.contactEmail ?? ""),
        applyUrl: String(profile.applyUrl ?? ""),
        kakaoChannelUrl: String(profile.kakaoChannelUrl ?? ""),
        coverImageUrl: String(profile.coverImageUrl ?? ""),
        images: Array.isArray(profile.images) ? profile.images.map(String) : [],
        isPublished: Boolean(profile.isPublished),
      },
    });
  } catch (error) {
    console.error("[PARTNER_PROFILE_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "업체 프로필을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (session.role !== "PARTNER") {
      return NextResponse.json(
        { ok: false, error: "제휴사 계정만 접근할 수 있습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const nameRaw = body?.name !== undefined ? String(body.name).trim().slice(0, 100) : null;

    if (nameRaw !== null && !nameRaw) {
      return NextResponse.json(
        { ok: false, error: "업체명을 입력해주세요." },
        { status: 400 }
      );
    }

    const intro = text(body?.intro, 2000);
    const benefitText = text(body?.benefitText, 2000);
    const address = text(body?.address, 300);
    const detailAddress = text(body?.detailAddress, 200);
    const phone = normalizePhone(body?.phone);
    const contactEmail = String(body?.contactEmail ?? "").trim().toLowerCase().slice(0, 200);
    const isPublished = normalizeBoolean(body?.isPublished);

    const applyUrl = normalizeUrl(body?.applyUrl);
    const kakaoChannelUrl = normalizeUrl(body?.kakaoChannelUrl);
    const coverImageUrl = normalizeUrl(body?.coverImageUrl);
    const images = Array.isArray(body?.images)
      ? body.images.map((u: unknown) => normalizeUrl(u)).filter((u: string | null) => u) as string[]
      : [];

    if (body?.applyUrl && applyUrl === null) {
      return NextResponse.json(
        {
          ok: false,
          error: "신청 링크는 http:// 또는 https:// 형식의 올바른 주소만 입력할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    if (body?.kakaoChannelUrl && kakaoChannelUrl === null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "카카오채널 링크는 http:// 또는 https:// 형식의 올바른 주소만 입력할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    if (body?.coverImageUrl && coverImageUrl === null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "대표 이미지 주소는 http:// 또는 https:// 형식의 올바른 주소만 입력할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const categories = await normalizeCategoryCodes(
      body?.categories,
      body?.category,
      {
        onlyActive: true,
        visibleToPartnerOnly: true,
        orgId: session.orgId ?? "default",
      }
    );

    const category = categories[0] ?? "";

    const updated = await User.findOneAndUpdate(
      {
        _id: session.uid,
        organizationId: session.orgId ?? "default",
        role: "PARTNER",
      },
      {
        $set: {
          ...(nameRaw !== null ? { name: nameRaw } : {}),
          "partnerProfile.category": category,
          "partnerProfile.categories": categories,
          "partnerProfile.intro": intro,
          "partnerProfile.benefitText": benefitText,
          "partnerProfile.address": address,
          "partnerProfile.detailAddress": detailAddress,
          "partnerProfile.phone": phone,
          "partnerProfile.contactEmail": contactEmail,
          "partnerProfile.applyUrl": applyUrl || "",
          "partnerProfile.kakaoChannelUrl": kakaoChannelUrl || "",
          "partnerProfile.coverImageUrl": coverImageUrl || "",
          "partnerProfile.images": images,
          "partnerProfile.isPublished": isPublished,
        },
      },
      {
        new: true,
        projection: {
          username: 1,
          name: 1,
          partnerProfile: 1,
        },
      }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "제휴사 계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const profile = (updated as any).partnerProfile ?? {};
    const normalizedSavedCategories = await normalizeCategoryCodes(
      profile.categories,
      profile.category,
      { orgId: session.orgId ?? "default" }
    );

    return NextResponse.json({
      ok: true,
      message: "업체 프로필이 저장되었습니다.",
      item: {
        username: String((updated as any).username ?? ""),
        name: String((updated as any).name ?? ""),
        category: String(profile.category ?? ""),
        categories: normalizedSavedCategories,
        intro: String(profile.intro ?? ""),
        benefitText: String(profile.benefitText ?? ""),
        address: String(profile.address ?? ""),
        detailAddress: String(profile.detailAddress ?? ""),
        phone: String(profile.phone ?? ""),
        contactEmail: String(profile.contactEmail ?? ""),
        applyUrl: String(profile.applyUrl ?? ""),
        kakaoChannelUrl: String(profile.kakaoChannelUrl ?? ""),
        coverImageUrl: String(profile.coverImageUrl ?? ""),
        images: Array.isArray(profile.images) ? profile.images.map(String) : [],
        isPublished: Boolean(profile.isPublished),
      },
    });
  } catch (error) {
    console.error("[PARTNER_PROFILE_PUT_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "업체 프로필을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}