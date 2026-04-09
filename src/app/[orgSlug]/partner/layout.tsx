// src/app/[orgSlug]/partner/layout.tsx
// =======================================================
// PARTNER 공통 레이아웃
// -------------------------------------------------------
// - 로그인 필수
// - PARTNER만 접근 가능
// - 공통 메뉴 / 컨테이너 제공
// - session 전달
// =======================================================

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import PartnerShellClient from "./PartnerShellClient";

export default async function PartnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSessionFromCookies();

  if (!session) {
    redirect(`/${orgSlug}/login`);
  }

  if (session.role === "ADMIN") {
    redirect(`/${session.orgId}/admin`);
  }

  if (session.role === "CUSTOMER") {
    redirect(`/${session.orgId}/customer`);
  }

  if (session.role !== "PARTNER") {
    redirect(`/${orgSlug}/login`);
  }

  if (session.orgId !== orgSlug) {
    redirect(`/${session.orgId}/partner`);
  }

  return (
    <PartnerShellClient
      session={{
        uid: session.uid,
        username: session.username,
        name: session.name,
        role: session.role,
      }}
    >
      {children}
    </PartnerShellClient>
  );
}
