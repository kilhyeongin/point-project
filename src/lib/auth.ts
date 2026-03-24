// src/lib/auth.ts
// Next 16 기준: cookies()가 async일 수 있어서 await cookies()로 사용한다.
// JWT 세션 생성/검증 + httpOnly 쿠키 저장 유틸

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET가 .env.local에 없습니다.");

const COOKIE_NAME = "session_token";

// 세션에 넣을 최소 정보 (보안상 과도한 정보 금지)
export type SessionPayload = {
  uid: string;
  role: "PARTNER" | "CUSTOMER" | "ADMIN" | "HOST";
  username: string;
  name: string;
};

// JWT 생성 (7일 유효)
export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

// JWT 검증
export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

// 쿠키에 세션 저장 (httpOnly)
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

// 쿠키 삭제 (로그아웃)
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

// 서버에서 현재 세션 읽기
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}