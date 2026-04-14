import { notFound, redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getPartnerCategoryMasters } from "@/lib/partnerCategories";
import CategoryPartnersClient from "./CategoryPartnersClient";

type PageProps = { params: Promise<{ orgSlug: string; code: string }> };

export default async function CategoryPartnersPage({ params }: PageProps) {
  const session = await getSessionFromCookies();
  const { orgSlug, code } = await params;

  if (!session) redirect(`/${orgSlug}/login`);
  if (session.role !== "CUSTOMER") redirect(`/${orgSlug}/customer`);

  await connectDB();

  const categories = await getPartnerCategoryMasters({
    activeOnly: true,
    visibleToCustomerOnly: true,
    orgId: session.orgId ?? "4nwn",
  });
  const category = categories.find((c) => c.code === code);
  if (!category) notFound();

  return (
    <CategoryPartnersClient
      session={{
        uid: session.uid,
        username: session.username,
        name: session.name,
        role: session.role,
      }}
      categoryCode={code}
      categoryName={category.name}
    />
  );
}
