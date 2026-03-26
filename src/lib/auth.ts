// src/lib/auth.ts
// JWT 세션 생성/검증 + httpOnly 쿠키 저장 유틸
// jti(JWT ID)를 이용한 토큰 블랙리스트 지원 (Upstash Redis 필요)

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getRedis } from "@/lib/redis";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET가 .env.local에 없습니다.");

const COOKIE_NAME = "session_token";
const TOKEN_TTL_SEC = 60 * 60 * 24; // 1일

// 세션에 넣을 최소 정보 (보안상 과도한 정보 금지)
export type SessionPayload = {
  uid: string;
  role: "PARTNER" | "CUSTOMER" | "ADMIN" | "HOST";
  username: string;
  name: string;
  jti: string; // 토큰 고유 ID (블랙리스트용)
};

// JWT 생성 (1일 유효)
export function signSession(payload: Omit<SessionPayload, "jti">) {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: "1d" });
}

// JWT 검증 (블랙리스트는 별도로 확인)
export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

// ── 토큰 블랙리스트 (Redis) ────────────────────────────────────────

/**
 * 토큰의 jti를 Redis 블랙리스트에 등록 (로그아웃 시 호출)
 * Redis 없으면 무시 (쿠키 삭제만으로 처리)
 */
export async function blacklistToken(jti: string, remainingSec: number): Promise<void> {
  const redis = getRedis();
  if (!redis || remainingSec <= 0) return;
  try {
    await redis.set(`bl:${jti}`, "1", { ex: remainingSec });
  } catch {
    // Redis 오류 시 무시 (쿠키 삭제는 항상 진행)
  }
}

/**
 * jti가 블랙리스트에 있는지 확인
 * Redis 없으면 false 반환 (블랙리스트 기능 비활성)
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const val = await redis.get(`bl:${jti}`);
    return val === "1";
  } catch {
    return false;
  }
}

// ── 쿠키 관련 ─────────────────────────────────────────────────────

// 쿠키에 세션 저장 (httpOnly)
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SEC,
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

// 서버에서 현재 세션 읽기 (블랙리스트 포함 검증)
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySession(token);
  if (!payload) return null;

  // 블랙리스트 확인
  if (payload.jti && (await isTokenBlacklisted(payload.jti))) {
    return null;
  }

  return payload;
}

// 현재 쿠키의 raw 토큰 반환 (로그아웃 시 블랙리스트 등록용)
export async function getRawTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}
