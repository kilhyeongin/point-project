import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getPartnerCategoryMasters } from "@/lib/partnerCategories";
import CustomerOnboardingClient from "./CustomerOnboardingClient";

export default async function CustomerOnboardingPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getSessionFromCookies();

  if (!session) {
    redirect(`/${orgSlug}/login`);
  }

  if (session.role === "ADMIN") redirect(`/${session.orgId}/admin`);
  if (session.role === "PARTNER") redirect(`/${session.orgId}/partner`);

  await connectDB();

  const me = await User.findById(
    session.uid,
    {
      customerProfile: 1,
    }
  ).lean();

  if (!me) {
    redirect(`/${orgSlug}/login`);
  }

  const customerProfile = (me as any).customerProfile ?? {};
  const onboardingCompleted = Boolean(customerProfile.onboardingCompleted);
  const initialInterests = Array.isArray(customerProfile.interests)
    ? customerProfile.interests
    : [];

  if (onboardingCompleted) {
    redirect(`/${orgSlug}/customer`);
  }

  const categoryItems = await getPartnerCategoryMasters({
    activeOnly: true,
    visibleToCustomerOnly: true,
    orgId: session.orgId ?? "default",
  });

  const interestOptions = categoryItems.map((item) => ({
    value: item.code,
    label: item.name,
  }));

  return (
    <CustomerOnboardingClient
      session={{
        uid: session.uid,
        username: session.username,
        name: session.name,
        role: session.role,
      }}
      initialInterests={initialInterests}
      interestOptions={interestOptions}
    />
  );
}
