import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import CategoryGridClient from "./CategoryGridClient";

export default async function CustomerPage() {
  const session = await getSessionFromCookies();

  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");
  if (session.role === "PARTNER") redirect("/partner");

  await connectDB();

  const me = await User.findById(session.uid, { customerProfile: 1 }).lean();
  if (!me) redirect("/login");

  const onboardingCompleted = Boolean((me as any)?.customerProfile?.onboardingCompleted);
  if (!onboardingCompleted) redirect("/customer/onboarding");

  return (
    <CategoryGridClient
      session={{
        uid: session.uid,
        username: session.username,
        name: session.name,
        role: session.role,
      }}
    />
  );
}