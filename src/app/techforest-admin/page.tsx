import { getSessionFromCookies } from "@/lib/auth";
import SuperAdminDashboardClient from "./SuperAdminDashboardClient";

export default async function SuperAdminPage() {
  const session = await getSessionFromCookies();
  return <SuperAdminDashboardClient session={session!} />;
}
