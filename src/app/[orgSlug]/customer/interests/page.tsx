import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import CustomerShellClient from "@/app/[orgSlug]/customer/CustomerShellClient";
import InterestsSettingForm from "@/app/[orgSlug]/customer/settings/InterestsSettingForm";

export default async function CustomerInterestsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getSessionFromCookies();
  if (!session || session.role !== "CUSTOMER") redirect(`/${orgSlug}/login`);

  return (
    <CustomerShellClient
      session={session}
      title="관심사 설정"
      backHref={`/${orgSlug}/customer`}
    >
      <InterestsSettingForm />
    </CustomerShellClient>
  );
}
