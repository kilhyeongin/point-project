// src/app/api/platform/organizations/route.ts
// =======================================================
// 플랫폼 운영자 전용: 조직(org) 생성 및 목록 조회
// -------------------------------------------------------
// 보안: Authorization: Bearer <PLATFORM_SECRET> 헤더 필요
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Organization } from "@/models/Organization";
import { User } from "@/models/User";
import { validatePassword } from "@/lib/validatePassword";

function getPlatformSecret() {
  return process.env.PLATFORM_SECRET ?? "";
}

function isAuthorized(req: NextRequest) {
  const secret = getPlatformSecret();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ── GET: 전체 조직 목록 조회 ──────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const orgs = await Organization.find({}, { slug: 1, name: 1, isActive: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .lean();

  const results = await Promise.all(
    (orgs as any[]).map(async (org) => {
      const adminCount = await User.countDocuments({ organizationId: org.slug, role: "ADMIN" });
      const partnerCount = await User.countDocuments({ organizationId: org.slug, role: "PARTNER" });
      const customerCount = await User.countDocuments({ organizationId: org.slug, role: "CUSTOMER" });
      return {
        slug: org.slug,
        name: org.name,
        isActive: org.isActive,
        createdAt: org.createdAt,
        adminCount,
        partnerCount,
        customerCount,
      };
    })
  );

  return NextResponse.json({ ok: true, organizations: results });
}

// ── POST: 신규 조직 + 관리자 계정 생성 ───────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const slug = String(body?.slug ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);

    const name = String(body?.name ?? "").trim().slice(0, 100);
    const adminUsername = String(body?.adminUsername ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30);
    const adminPassword = String(body?.adminPassword ?? "");
    const adminName = String(body?.adminName ?? name + " 관리자").trim().slice(0, 50);

    // 입력값 검증
    if (!slug || slug.length < 2) {
      return NextResponse.json(
        { ok: false, error: "slug는 영문 소문자·숫자·하이픈, 2자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json({ ok: false, error: "조직 이름을 입력해 주세요." }, { status: 400 });
    }

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

    // slug 중복 확인
    const existingOrg = await Organization.findOne({ slug }).lean();
    if (existingOrg) {
      return NextResponse.json(
        { ok: false, error: `이미 사용 중인 slug입니다: ${slug}` },
        { status: 409 }
      );
    }

    // 관리자 username 중복 확인 (같은 org 내)
    const existingAdmin = await User.findOne({ username: adminUsername, organizationId: slug }, { _id: 1 }).lean();
    if (existingAdmin) {
      return NextResponse.json(
        { ok: false, error: "이미 사용 중인 관리자 아이디입니다." },
        { status: 409 }
      );
    }

    // 조직 생성
    const org = await Organization.create({ slug, name, isActive: true });

    // 관리자 계정 생성
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminUser = await User.create({
      organizationId: slug,
      username: adminUsername,
      passwordHash,
      name: adminName,
      role: "ADMIN",
      status: "ACTIVE",
      pointBalance: 0,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

    return NextResponse.json({
      ok: true,
      organization: {
        slug: org.slug,
        name: org.name,
        isActive: org.isActive,
      },
      admin: {
        username: adminUser.username,
        name: adminUser.name,
      },
      loginUrl: `${baseUrl}/${slug}/login`,
    });
  } catch (error) {
    console.error("[PLATFORM_ORG_CREATE_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "조직 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
