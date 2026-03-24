import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getPartnerCategoryMasters } from "@/lib/partnerCategories";
import CustomerOnboardingClient from "./CustomerOnboardingClient";

export default async function CustomerOnboardingPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  if (session.role === "ADMIN") redirect("/admin");
  if (session.role === "PARTNER") redirect("/partner");

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

  const customerProfile = (me as any).customerProfile ?? {};
  const onboardingCompleted = Boolean(customerProfile.onboardingCompleted);
  const initialInterests = Array.isArray(customerProfile.interests)
    ? customerProfile.interests
    : [];

  if (onboardingCompleted) {
    redirect("/customer");
  }

  const categoryItems = await getPartnerCategoryMasters({
    activeOnly: true,
    visibleToCustomerOnly: true,
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