// src/app/[orgSlug]/customer/favorites/page.tsx
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import CustomerFavoritesClient from "./CustomerFavoritesClient";

export default async function CustomerFavoritesPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getSessionFromCookies();

  if (!session) {
    redirect(`/${orgSlug}/login`);
  }

  if (session.role === "ADMIN") {
    redirect(`/${session.orgId}/admin`);
  }

  if (session.role === "PARTNER") {
    redirect(`/${session.orgId}/partner`);
  }

  if (session.role !== "CUSTOMER") {
    redirect(`/${orgSlug}/login`);
  }

  await connectDB();

  const me = await User.findOne(
    { _id: session.uid, organizationId: orgSlug },
    { customerProfile: 1 }
  ).lean();

  if (!me) {
    redirect(`/${orgSlug}/login`);
  }

  const onboardingCompleted = Boolean(
    (me as any)?.customerProfile?.onboardingCompleted
  );

  if (!onboardingCompleted) {
    redirect(`/${orgSlug}/customer/onboarding`);
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
