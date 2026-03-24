// src/app/customer/favorites/page.tsx
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import CustomerFavoritesClient from "./CustomerFavoritesClient";

export default async function CustomerFavoritesPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  if (session.role === "ADMIN") {
    redirect("/admin");
  }

  if (session.role === "PARTNER") {
    redirect("/partner");
  }

  if (session.role !== "CUSTOMER") {
    redirect("/login");
  }

  await connectDB();

  const me = await User.findById(
    session.uid,
    {
      customerProfile: 1,
    }
  ).lean();

  if (!me) {
    redirect("/login");
  }

  const onboardingCompleted = Boolean(
    (me as any)?.customerProfile?.onboardingCompleted
  );

  if (!onboardingCompleted) {
    redirect("/customer/onboarding");
  }

  return (
    <CustomerFavoritesClient
      session={{
        uid: session.uid,
        username: session.username,
        name: session.name,
        role: session.role,
      }}
    />
  );
}