// src/app/api/me/route.ts
// 현재 로그인된 사용자 세션 정보 반환
// - 쿠키의 JWT를 검증해서 사용자 정보 리턴
// - 로그인 안 되어 있으면 401

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, session: null },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    session,
  });
}