// src/app/api/auth/logout/route.ts
// 로그아웃 API
// - 현재 토큰의 jti를 Redis 블랙리스트에 등록
// - 세션 쿠키 삭제

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { clearSessionCookie, getRawTokenFromCookies, blacklistToken } from "@/lib/auth";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function POST() {
  const raw = await getRawTokenFromCookies();

  if (raw) {
    try {
      const decoded = jwt.decode(raw) as { jti?: string; exp?: number } | null;
      if (decoded?.jti) {
        const remainingSec = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0;
        await blacklistToken(decoded.jti, remainingSec);
      }
    } catch {
      // 디코드 실패 시 무시 — 쿠키 삭제는 항상 진행
    }
  }

  await clearSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("session_token");
  return res;
}
