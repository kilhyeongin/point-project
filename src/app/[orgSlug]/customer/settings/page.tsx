import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import CustomerShellClient from "@/app/[orgSlug]/customer/CustomerShellClient";
import CustomerMyPageClient from "./CustomerMyPageClient";

export default async function CustomerSettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getSessionFromCookies();
  if (!session || session.role !== "CUSTOMER") redirect(`/${orgSlug}/login`);

  return (
    <CustomerShellClient session={session} title="마이페이지" description="개인정보 및 계정 설정을 관리합니다.">
      <CustomerMyPageClient />
    </CustomerShellClient>
  );
}
