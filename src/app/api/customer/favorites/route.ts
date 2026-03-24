// src/app/api/customer/favorites/route.ts
// =======================================================
// CUSTOMER: 관심업체(찜) 목록 조회 / 추가
// -------------------------------------------------------
// GET  : 내 관심업체 partnerId 목록 조회
// POST : 특정 업체 찜하기 (LIKED)
// =======================================================

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FavoritePartner } from "@/models/FavoritePartner";
import { User } from "@/models/User";

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

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

  const docs = await FavoritePartner.find(
    { customerId: session.uid, likedByCustomer: true },
    { partnerId: 1, status: 1 }
  ).lean();

  const partnerIds = docs.map((d: any) => String(d.partnerId));

  return NextResponse.json({
    ok: true,
    partnerIds,
    items: docs.map((d: any) => ({
      partnerId: String(d.partnerId),
      status: String(d.status ?? "LIKED"),
    })),
  });
}

export async function POST(req: Request) {
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

  const body = await req.json();
  const partnerId = String(body?.partnerId ?? "");

  if (!partnerId || !isValidObjectId(partnerId)) {
    return NextResponse.json(
      { ok: false, message: "잘못된 업체 ID입니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const partner = await User.findOne({
    _id: partnerId,
    role: "PARTNER",
    status: "ACTIVE",
    "partnerProfile.isPublished": true,
  }).lean();

  if (!partner) {
    return NextResponse.json(
      { ok: false, message: "찜할 수 없는 업체입니다." },
      { status: 404 }
    );
  }

  await FavoritePartner.updateOne(
    {
      customerId: session.uid,
      partnerId,
    },
    {
      $set: { likedByCustomer: true },
      $setOnInsert: {
        customerId: session.uid,
        partnerId,
        status: "LIKED",
      },
    },
    {
      upsert: true,
    }
  );

  return NextResponse.json({
    ok: true,
    partnerId,
    status: "LIKED",
    message: "관심업체에 저장되었습니다.",
  });
}
