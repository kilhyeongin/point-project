// src/app/api/platform/setup/route.ts
// =======================================================
// 최초 1회 실행: default org 생성 + 기존 데이터 마이그레이션
// -------------------------------------------------------
// 보안: Authorization: Bearer <PLATFORM_SECRET> 헤더 필요
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Organization } from "@/models/Organization";
import { User } from "@/models/User";
import { validatePassword } from "@/lib/validatePassword";

function isAuthorized(req: NextRequest) {
  const secret = process.env.PLATFORM_SECRET ?? "";
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const COLLECTIONS = [
  "users",
  "ledgers",
  "wallets",
  "settlements",
  "favoritepartners",
  "issuerequests",
  "userequests",
  "topuprequests",
  "auditlogs",
  "settlementperiods",
  "partnercategorymasters",
];

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const orgName = String(body?.orgName ?? "기본 조직").trim();
    const adminUsername = String(body?.adminUsername ?? "").trim().toLowerCase();
    const adminPassword = String(body?.adminPassword ?? "");
    const adminName = String(body?.adminName ?? "관리자").trim();

    if (!adminUsername || adminUsername.length < 4) {
      return NextResponse.json(
        { ok: false, error: "관리자 아이디는 4자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const pwCheck = validatePassword(adminPassword);
    if (!pwCheck.ok) {
      return NextResponse.json({ ok: false, error: pwCheck.error }, { status: 400 });
    }

    await connectDB();
    const db = mongoose.connection.db!;

    // 1. default org 생성 (이미 있으면 스킵)
    const existingOrg = await Organization.findOne({ slug: "default" }).lean();
    let orgCreated = false;

    if (!existingOrg) {
      await Organization.create({ slug: "default", name: orgName, isActive: true });
      orgCreated = true;
    }

    // 2. 기존 데이터 마이그레이션 (organizationId 없는 문서에 "default" 세팅)
    const migrationResults: Record<string, number> = {};
    for (const col of COLLECTIONS) {
      try {
        const result = await db
          .collection(col)
          .updateMany(
            { organizationId: { $exists: false } },
            { $set: { organizationId: "default" } }
          );
        migrationResults[col] = result.modifiedCount;
      } catch {
        migrationResults[col] = -1;
      }
    }

    // 3. 관리자 계정 생성 (이미 있으면 스킵)
    const existingAdmin = await User.findOne({ username: adminUsername, organizationId: "default" }).lean();
    let adminCreated = false;

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await User.create({
        organizationId: "default",
        username: adminUsername,
        passwordHash,
        name: adminName,
        role: "ADMIN",
        status: "ACTIVE",
        pointBalance: 0,
      });
      adminCreated = true;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

    return NextResponse.json({
      ok: true,
      orgCreated,
      adminCreated,
      migrationResults,
      loginUrl: `${baseUrl}/default/login`,
    });
  } catch (error) {
    console.error("[PLATFORM_SETUP_ERROR]", error);
    return NextResponse.json({ ok: false, error: "설정에 실패했습니다." }, { status: 500 });
  }
}
