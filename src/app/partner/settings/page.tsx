import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default async function PartnerSettingsPage() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER") redirect("/login");

  return (
    <div className="space-y-5">
      <section className="bg-card shadow-card rounded-2xl p-5">
        <h1 className="text-xl font-black text-foreground tracking-tight">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">계정 보안 설정을 관리합니다.</p>
      </section>

      <section className="bg-card shadow-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide pb-3 border-b border-border mb-5">
          비밀번호 변경
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
