import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ReactNode } from "react";

const ROLE_DASHBOARD: Record<string, string> = {
  CUSTOMER: "customer",
  PARTNER: "partner",
  ADMIN: "admin",
  SUPER_ADMIN: "admin",
  HOST: "admin",
};

export default async function SignupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await getSessionFromCookies();

  if (session) {
    const { orgSlug } = await params;
    const dest = ROLE_DASHBOARD[session.role] ?? "customer";
    redirect(`/${orgSlug}/${dest}`);
  }

  return <>{children}</>;
}
