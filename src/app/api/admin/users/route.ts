// src/app/api/admin/users/route.ts
// ===========================================
// 관리자(ADMIN) 전용: 사용자 목록 조회 + 검색 API
// -------------------------------------------
// ✔ 로그인 확인
// ✔ ADMIN 권한 확인
// ✔ q 검색 지원 (username / name)
// ✔ role 필터 지원 (?role=PARTNER)
// ✔ 민감정보 절대 반환 금지
// ===========================================

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "관리자만 접근 가능합니다." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const roleParam = String(searchParams.get("role") ?? "").trim(); // "PARTNER"

  await connectDB();

  const filter: any = {};

  // ✅ role 필터
  if (roleParam) {
    const roles = roleParam
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean);

    if (roles.length > 0) {
      filter.role = { $in: roles };
    }
  }

  // ✅ q 검색
  if (q) {
    filter.$or = [
      { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\$&"), $options: "i" } },
      { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\$&"), $options: "i" } },
    ];
  }

  const users = await User.find(
    filter,
    { username: 1, name: 1, role: 1, status: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(100);

  return NextResponse.json({
    ok: true,
    items: users.map((u: any) => ({
      id: u._id.toString(),
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "관리자만 접근 가능합니다." }, { status: 403 });
  }

  const body = await req.json();
  const username = String(body?.username ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  const password = String(body?.password ?? "");

  if (!username || username.length < 4) {
    return NextResponse.json(
      { ok: false, message: "아이디는 4자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (!name) {
    return NextResponse.json(
      { ok: false, message: "이름을 입력해 주세요." },
      { status: 400 }
    );
  }

  if (!password || password.length < 8) {
    return NextResponse.json(
      { ok: false, message: "비밀번호는 8자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const exists = await User.findOne({ username }, { _id: 1 }).lean();
  if (exists) {
    return NextResponse.json(
      { ok: false, message: "이미 사용 중인 아이디입니다." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    username,
    name,
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
  });

  return NextResponse.json({
    ok: true,
    id: user._id.toString(),
    username: user.username,
    name: user.name,
  });
}