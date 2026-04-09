import { connectDB } from "@/lib/db";
import { Organization } from "@/models/Organization";
import { notFound } from "next/navigation";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await connectDB();
  const org = await Organization.findOne({ slug: orgSlug, isActive: true }, { _id: 1 }).lean();
  if (!org) notFound();
  return <>{children}</>;
}
