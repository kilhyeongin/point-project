// src/app/api/admin/users/[id]/role/route.ts
// 관리자(ADMIN) 전용: 특정 사용자 ROLE 변경 API (Next16 params 호환)

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import mongoose from "mongoose";

type AllowedRole = "PARTNER" | "CUSTOMER";

function isAllowedRole(v: any): v is AllowedRole {
  return v === "PARTNER" || v === "CUSTOMER";
}

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> } // ✅ 둘 다 대응
) {
  try {
    // 1) 세션 확인
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    // 2) ADMIN 권한 확인
    if (session.role !== "ADMIN") {
      return NextResponse.json({ ok: false, message: "관리자만 접근 가능합니다." }, { status: 403 });
    }

    // 3) ✅ Next16 호환: params가 Promise일 수도 있어서 안전하게 처리
    const params = await Promise.resolve((ctx as any).params);
    const userId = params?.id;

    if (!userId || typeof userId !== "string" || !isValidObjectId(userId)) {
      return NextResponse.json({ ok: false, message: "잘못된 사용자 ID입니다." }, { status: 400 });
    }

    // 4) 요청 바디에서 role 받기
    const body = await req.json();
    const nextRole = body?.role;

    // 5) role 유효성 검사 (ADMIN 승격 금지)
    if (!isAllowedRole(nextRole)) {
      return NextResponse.json(
        { ok: false, message: "role은 PARTNER / CUSTOMER 중 하나여야 합니다." },
        { status: 400 }
      );
    }

    // 6) DB 연결
    await connectDB();

    // 7) 대상 사용자 조회
    const target = await User.findById(userId);
    if (!target) {
      return NextResponse.json({ ok: false, message: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 8) role 변경
    target.role = nextRole;
    await target.save();

    // 9) 응답 (민감정보 제외)
    return NextResponse.json({
      ok: true,
      item: {
        id: target._id.toString(),
        username: target.username,
        name: target.name,
        role: target.role,
        status: target.status,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "서버 오류" }, { status: 500 });
  }
}