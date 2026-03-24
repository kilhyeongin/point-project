// src/app/api/admin/users/[id]/partner-profile/route.ts
// =======================================================
// ADMIN: 특정 PARTNER의 고객 노출 프로필 수정 API
// -------------------------------------------------------
// PATCH body:
// - category
// - intro
// - benefitText
// - kakaoChannelUrl
// - applyUrl
// - address
// - phone
// - coverImageUrl
// - isPublished
// =======================================================

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

function toTrimmedString(v: unknown) {
  return String(v ?? "").trim();
}

function toBoolean(v: unknown) {
  return v === true;
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { ok: false, message: "관리자만 접근 가능합니다." },
        { status: 403 }
      );
    }

    const params = await Promise.resolve((ctx as any).params);
    const userId = params?.id;

    if (!userId || typeof userId !== "string" || !isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, message: "잘못된 사용자 ID입니다." },
        { status: 400 }
      );
    }

    const body = await req.json();

    await connectDB();

    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (user.role !== "PARTNER") {
      return NextResponse.json(
        { ok: false, message: "제휴사 계정만 수정할 수 있습니다." },
        { status: 400 }
      );
    }

    user.partnerProfile = {
      category: toTrimmedString(body?.category),
      intro: toTrimmedString(body?.intro),
      benefitText: toTrimmedString(body?.benefitText),
      kakaoChannelUrl: toTrimmedString(body?.kakaoChannelUrl),
      applyUrl: toTrimmedString(body?.applyUrl),
      address: toTrimmedString(body?.address),
      phone: toTrimmedString(body?.phone),
      coverImageUrl: toTrimmedString(body?.coverImageUrl),
      isPublished: toBoolean(body?.isPublished),
    };

    await user.save();

    return NextResponse.json({
      ok: true,
      item: {
        id: String(user._id),
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,
        partnerProfile: {
          category: String(user.partnerProfile?.category ?? ""),
          intro: String(user.partnerProfile?.intro ?? ""),
          benefitText: String(user.partnerProfile?.benefitText ?? ""),
          kakaoChannelUrl: String(user.partnerProfile?.kakaoChannelUrl ?? ""),
          applyUrl: String(user.partnerProfile?.applyUrl ?? ""),
          address: String(user.partnerProfile?.address ?? ""),
          phone: String(user.partnerProfile?.phone ?? ""),
          coverImageUrl: String(user.partnerProfile?.coverImageUrl ?? ""),
          isPublished: Boolean(user.partnerProfile?.isPublished ?? false),
        },
      },
      message: "제휴사 프로필이 저장되었습니다.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "서버 오류" },
      { status: 500 }
    );
  }
}