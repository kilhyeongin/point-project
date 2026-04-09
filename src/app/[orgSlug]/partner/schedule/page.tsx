import { redirect } from "next/navigation";

export default async function PartnerSchedulePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/partner/appointments`);
}
