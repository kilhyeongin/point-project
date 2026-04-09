import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSessionFromCookies();

  if (session) {
    if (session.role === "ADMIN") redirect(`/${orgSlug}/admin`);
    if (session.role === "PARTNER") redirect(`/${orgSlug}/partner`);
    redirect(`/${orgSlug}/customer`);
  }

  return <LoginForm />;
}
