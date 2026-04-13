import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";

export default async function CommonLoginPage() {
  const session = await getSessionFromCookies();
  if (session) {
    const orgId = session.orgId ?? "4nwn";
    if (session.role === "ADMIN") redirect(`/${orgId}/admin`);
    if (session.role === "PARTNER") redirect(`/${orgId}/partner`);
    redirect(`/${orgId}/customer`);
  }

  redirect("/4nwn/login");
}
