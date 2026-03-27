import { notFound, redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";
import {
  getCategoryLabels,
  normalizeCategoryCodes,
} from "@/lib/partnerCategories";
import ApplyPartnerButton from "@/app/customer/ApplyPartnerButton";
import Link from "next/link";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPartnerDetailPage({ params }: PageProps) {
  const session = await getSessionFromCookies();

  if (!session) redirect("/login");
  if (session.role !== "CUSTOMER") redirect("/");

  const { id } = await params;

  await connectDB();

  const [doc, relation] = await Promise.all([
    User.findOne(
      {
        _id: id,
        role: "PARTNER",
        status: "ACTIVE",
        "partnerProfile.isPublished": true,
      },
      {
        username: 1,
        name: 1,
        partnerProfile: 1,
      }
    ).lean(),
    FavoritePartner.findOne(
      {
        customerId: session.uid,
        partnerId: id,
      },
      {
        status: 1,
        createdAt: 1,
        appliedAt: 1,
        appointmentAt: 1,
        appointmentNote: 1,
        appointmentHistory: 1,
      }
    ).lean(),
  ]);

  if (!doc) notFound();

  const profile = (doc as any).partnerProfile ?? {};
  const categoryCodes = await normalizeCategoryCodes(
    profile.categories,
    profile.category
  );
  const categoryLabels = await getCategoryLabels(categoryCodes);

  const relationStatus = String((relation as any)?.status ?? "NONE");
  const applied = relationStatus === "APPLIED";
  const liked = relationStatus === "LIKED";

  const partnerName = String((doc as any).name ?? "");
  const coverImageUrl = String(profile.coverImageUrl ?? "").trim();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/customer"
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 뒤로
          </Link>
          <span className="text-base font-black text-foreground tracking-tight truncate">
            {partnerName}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-10">
        {/* Hero */}
        {coverImageUrl && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted">
            <img src={coverImageUrl} alt={partnerName} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Partner name + category */}
        <div className="bg-card shadow-card rounded-2xl p-5">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categoryLabels.length > 0 ? (
              categoryLabels.map((label) => (
                <span key={label} className="inline-flex items-center h-6 px-2.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                  {label}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">기타</span>
            )}
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">{partnerName}</h1>
          {profile.intro && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{String(profile.intro)}</p>
          )}
        </div>

        {/* Business info */}
        <div className="bg-card shadow-card rounded-2xl p-5">
          <h2 className="text-base font-black text-foreground mb-4">업체 정보</h2>
          <div className="space-y-0">
            {[
              { label: "카테고리", value: categoryLabels.length > 0 ? categoryLabels.join(", ") : "기타" },
              { label: "혜택 안내", value: String(profile.benefitText ?? "-") },
              { label: "주소", value: [profile.address, profile.detailAddress].filter(Boolean).join(" ") || "-" },
              { label: "전화번호", value: String(profile.phone ?? "-") },
            ].map(({ label, value }) => (
              <div key={label} className="flex py-3 border-b border-border/60 last:border-0 gap-4">
                <span className="w-20 shrink-0 text-xs font-bold text-muted-foreground pt-0.5">{label}</span>
                <span className="text-sm text-foreground whitespace-pre-line">{value}</span>
              </div>
            ))}
            {profile.kakaoChannelUrl && (
              <div className="flex py-3 gap-4">
                <span className="w-20 shrink-0 text-xs font-bold text-muted-foreground pt-0.5">카카오채널</span>
                <a href={String(profile.kakaoChannelUrl)} target="_blank" rel="noreferrer"
                  className="text-sm text-primary font-bold hover:underline underline-offset-2">
                  바로가기 →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Apply section */}
        <div className="bg-card shadow-card rounded-2xl p-5 space-y-3">
          <h2 className="text-base font-black text-foreground">신청 및 정보 공개</h2>
          <ApplyPartnerButton
            partnerId={String((doc as any)._id)}
            initialApplied={applied}
            initialAppointmentAt={(relation as any)?.appointmentAt ? new Date((relation as any).appointmentAt).toISOString() : null}
            initialAppointmentNote={String((relation as any)?.appointmentNote ?? "")}
            initialAppointmentHistory={Array.isArray((relation as any)?.appointmentHistory) ? (relation as any).appointmentHistory.map((h: Record<string, unknown>) => ({
              action: String(h.action),
              appointmentAt: h.appointmentAt ? new Date(h.appointmentAt as string).toISOString() : "",
              appointmentNote: String(h.appointmentNote ?? ""),
              previousAppointmentAt: h.previousAppointmentAt ? new Date(h.previousAppointmentAt as string).toISOString() : null,
              createdAt: h.createdAt ? new Date(h.createdAt as string).toISOString() : "",
            })) : []}
            externalApplyUrl={String(profile.applyUrl ?? "").trim()}
            scheduleConfig={{
              scheduleEnabled: true,
              operatingDays: Array.isArray(profile.operatingDays) ? profile.operatingDays : [1,2,3,4,5],
              openTime: String(profile.openTime ?? "09:00"),
              closeTime: String(profile.closeTime ?? "18:00"),
              slotMinutes: Number(profile.slotMinutes ?? 30),
              maxPerSlot: Number(profile.maxPerSlot ?? 1),
              advanceDays: Number(profile.advanceDays ?? 30),
              breakStart: String(profile.breakStart ?? ""),
              breakEnd: String(profile.breakEnd ?? ""),
              closedOnHolidays: Boolean(profile.closedOnHolidays ?? true),
              blockedDates: Array.isArray(profile.blockedDates) ? profile.blockedDates : [],
            }}
          />
        </div>
      </div>
    </div>
  );
}
