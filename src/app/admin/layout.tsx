import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import AdminShellClient from "./AdminShellClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  if (session.role === "CUSTOMER") {
    redirect("/customer");
  }

  if (session.role === "PARTNER") {
    redirect("/partner");
  }

  if (session.role !== "ADMIN") {
    redirect("/login");
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