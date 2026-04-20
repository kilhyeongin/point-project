import { redirect } from "next/navigation";

export default async function SettlementsRootPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/partner/settlements/general`);
}
