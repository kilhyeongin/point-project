// src/app/customer/page.tsx
// =======================================================
// CUSTOMER 메인 페이지
// -------------------------------------------------------
// - 로그인 필수
// - CUSTOMER만 접근 허용
// - 관심사 온보딩 미완료 시 /customer/onboarding 으로 이동
// =======================================================

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import CustomerDashboardClient from "./CustomerDashboardClient";

export default async function CustomerPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  if (session.role === "ADMIN") redirect("/admin");
  if (session.role === "PARTNER") redirect("/partner");

  await connectDB();

  const me = await User.findById(
    session.uid,
    {
      customerProfile: 1,
    }
  ).lean();

  if (!me) {
    redirect("/login");
  }

  const onboardingCompleted = Boolean(
    (me as any)?.customerProfile?.onboardingCompleted
  );

  if (!onboardingCompleted) {
    redirect("/customer/onboarding");
  }

  return (
    <CustomerDashboardClient
      session={{
        uid: session.uid,
        username: session.username,
        name: session.name,
        role: session.role,
      }}
    />
  );
}