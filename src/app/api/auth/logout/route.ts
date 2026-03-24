// src/app/api/auth/logout/route.ts
// 로그아웃 API
// - 세션 쿠키(session_token)를 삭제해서 로그아웃 처리한다.

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}