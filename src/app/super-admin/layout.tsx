import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromCookies();

  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/super-admin/login");
  }

  return <>{children}</>;
}
