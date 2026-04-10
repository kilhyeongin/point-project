import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import CommonLoginForm from "./CommonLoginForm";

export default async function CommonLoginPage() {
  const session = await getSessionFromCookies();
  if (session) {
    const orgId = session.orgId ?? "default";
    if (session.role === "ADMIN") redirect(`/${orgId}/admin`);
    if (session.role === "PARTNER") redirect(`/${orgId}/partner`);
    redirect(`/${orgId}/customer`);
  }

  return <CommonLoginForm />;
}
