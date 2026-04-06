import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 소셜 계정 username(naver_xxx, kakao_xxx)을 읽기 좋게 변환 */
export function formatUsername(username: string): string {
  if (username.startsWith("naver_")) return "네이버 계정";
  if (username.startsWith("kakao_")) return "카카오 계정";
  return username;
}

/** "이름 (아이디)" 형태로 표시 — 소셜 계정은 "이름 (네이버 계정)" */
export function formatUserDisplay(name: string, username: string): string {
  return `${name} (${formatUsername(username)})`;
}
