// src/app/api/platform/rename-org/route.ts
// =======================================================
// 플랫폼 운영자 전용: org slug 변경 + 전체 데이터 일괄 업데이트
// -------------------------------------------------------
// 보안: Authorization: Bearer <PLATFORM_SECRET> 헤더 필요
// POST body: { "fromSlug": "default", "toSlug": "abc123" }
//            toSlug 생략 시 자동 랜덤 생성
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Organization } from "@/models/Organization";

const COLLECTIONS = [
  "users", "ledgers", "wallets", "settlements",
  "favoritepartners", "issuerequests", "userequests",
  "topuprequests", "auditlogs", "settlementperiods", "partnercategorymasters",
];

function isAuthorized(req: NextRequest) {
  const secret = process.env.PLATFORM_SECRET ?? "";
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function generateSlug(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = generateSlug(8);
    const exists = await Organization.findOne({ slug }, { _id: 1 }).lean();
    if (!exists) return slug;
  }
  return generateSlug(12);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const fromSlug = String(body?.fromSlug ?? "default").trim();
    const rawToSlug = String(body?.toSlug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50);

    await connectDB();
    const db = mongoose.connection.db!;

    // fromSlug org 존재 확인
    const org = await Organization.findOne({ slug: fromSlug }).lean();
    if (!org) {
      return NextResponse.json({ ok: false, error: `org '${fromSlug}'를 찾을 수 없습니다.` }, { status: 404 });
    }

    // toSlug 결정 (입력 없으면 랜덤 생성)
    const toSlug = rawToSlug.length >= 2 ? rawToSlug : await uniqueSlug();

    // toSlug 중복 확인
    const existingTarget = await Organization.findOne({ slug: toSlug }).lean();
    if (existingTarget) {
      return NextResponse.json({ ok: false, error: `slug '${toSlug}'는 이미 사용 중입니다.` }, { status: 409 });
    }

    // 1. Organization slug 변경
    await Organization.updateOne({ slug: fromSlug }, { $set: { slug: toSlug } });

    // 2. 전체 컬렉션 organizationId 일괄 변경
    const results: Record<string, number> = {};
    for (const col of COLLECTIONS) {
      try {
        const result = await db.collection(col).updateMany(
          { organizationId: fromSlug },
          { $set: { organizationId: toSlug } }
        );
        results[col] = result.modifiedCount;
      } catch {
        results[col] = -1;
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

    return NextResponse.json({
      ok: true,
      fromSlug,
      toSlug,
      updatedCollections: results,
      loginUrl: `${baseUrl}/${toSlug}/login`,
    });
  } catch (error) {
    console.error("[PLATFORM_RENAME_ORG_ERROR]", error);
    return NextResponse.json({ ok: false, error: "slug 변경에 실패했습니다." }, { status: 500 });
  }
}
