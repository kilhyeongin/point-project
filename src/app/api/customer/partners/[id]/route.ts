// src/app/api/customer/partners/[id]/route.ts
// =======================================================
// CUSTOMER 전용: 공개된 제휴사 상세 조회
// -------------------------------------------------------
// - 로그인 필요
// - CUSTOMER만 접근 가능
// - ACTIVE + isPublished=true 인 PARTNER만 조회
// =======================================================

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
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

  const params = await Promise.resolve((ctx as any).params);
  const id = String(params?.id ?? "");

  if (!id || !isValidObjectId(id)) {
    return NextResponse.json(
      { ok: false, message: "잘못된 업체 ID입니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const doc = await User.findOne(
    {
      _id: id,
      organizationId: session.orgId ?? "default",
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

  if (!doc) {
    return NextResponse.json(
      { ok: false, message: "업체를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const profile = (doc as any).partnerProfile ?? {};

  return NextResponse.json({
    ok: true,
    item: {
      id: String((doc as any)._id),
      username: String((doc as any).username ?? ""),
      name: String((doc as any).name ?? ""),
      category: String(profile.category ?? "").trim() || "기타",
      intro: String(profile.intro ?? "").trim(),
      benefitText: String(profile.benefitText ?? "").trim(),
      kakaoChannelUrl: String(profile.kakaoChannelUrl ?? "").trim(),
      applyUrl: String(profile.applyUrl ?? "").trim(),
      address: String(profile.address ?? "").trim(),
      phone: String(profile.phone ?? "").trim(),
      coverImageUrl: String(profile.coverImageUrl ?? "").trim(),
    },
  });
}