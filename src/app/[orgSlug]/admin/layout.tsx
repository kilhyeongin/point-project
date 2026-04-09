import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import AdminShellClient from "./AdminShellClient";

export default async function AdminLayout({
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

  if (session.role === "CUSTOMER") {
    redirect(`/${session.orgId}/customer`);
  }

  if (session.role === "PARTNER") {
    redirect(`/${session.orgId}/partner`);
  }

  if (session.role !== "ADMIN") {
    redirect(`/${orgSlug}/login`);
  }

  if (session.orgId !== orgSlug) {
    redirect(`/${session.orgId}/admin`);
  }

  return (
    <AdminShellClient
      session={{
        uid: session.uid,
        username: session.username,
        name: session.name,
        role: session.role,
      }}
    >
      {children}
    </AdminShellClient>
  );
}
