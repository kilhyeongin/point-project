import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getPartnerCategoryMasters } from "@/lib/partnerCategories";
import LandingClient from "./LandingClient";

const EXCLUDED_CODES = new Set(["VIDEO", "BOUQUET", "MC", "GIFT"]);

export default async function HomePage() {
  const session = await getSessionFromCookies();

  // 로그인된 유저는 역할별 대시보드로 바로 이동
  if (session) {
    const orgId = session.orgId ?? "default";
    if (session.role === "ADMIN") redirect(`/${orgId}/admin`);
    if (session.role === "PARTNER") redirect(`/${orgId}/partner`);
    redirect(`/${orgId}/customer`);
  }

  // 비로그인 → 랜딩페이지 (카테고리 목록 표시)
  await connectDB();
  const allCategories = await getPartnerCategoryMasters({
    activeOnly: true,
    visibleToCustomerOnly: true,
  });

  const categories = allCategories
    .filter((cat) => !EXCLUDED_CODES.has(cat.code))
    .map((cat) => ({ code: cat.code, name: cat.name }));

  return <LandingClient categories={categories} />;
}
