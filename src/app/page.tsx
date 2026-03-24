// src/app/page.tsx
// 홈 페이지 (정석)
// - API 호출로 세션 확인하지 않고, 서버에서 쿠키를 직접 읽어서 세션 확인
// - role에 따라 즉시 redirect()

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSessionFromCookies();

  // 로그인 안 되어 있으면 로그인으로
  if (!session) {
    redirect("/login");
  }

  // 역할별 대시보드로 즉시 이동
  if (session.role === "ADMIN") redirect("/admin");
  if (session.role === "PARTNER") redirect("/partner");

  // 기본은 CUSTOMER
  redirect("/customer");
}