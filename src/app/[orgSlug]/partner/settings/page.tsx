import { redirect } from "next/navigation";

export default async function PartnerSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/partner/profile`);
}
