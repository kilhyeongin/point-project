import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await getSessionFromCookies();

  if (session) {
    if (session.role === "ADMIN") redirect("/admin");
    if (session.role === "PARTNER") redirect("/partner");
    redirect("/customer");
  }

  return <LoginForm />;
}
