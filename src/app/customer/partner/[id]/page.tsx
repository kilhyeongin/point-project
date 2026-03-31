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
import BackButton from "./BackButton";
import ImageCarousel from "./ImageCarousel";

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

  const address = [profile.address, profile.detailAddress].filter(Boolean).join(" ");
  const phone = String(profile.phone ?? "").trim();
  const benefitText = String(profile.benefitText ?? "").trim();
  const kakaoChannelUrl = String(profile.kakaoChannelUrl ?? "").trim();
  const carouselImages = [
    coverImageUrl,
    ...(Array.isArray(profile.images) ? profile.images.map((u: unknown) => String(u).trim()) : []),
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl"
        style={{ boxShadow: "0 1px 0 oklch(0.918 0.008 250), 0 2px 12px -4px oklch(0 0 0 / 0.06)" }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <BackButton />
          <span className="text-base font-black text-foreground tracking-tight truncate">
            {partnerName}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto pb-12">
        {/* 이미지 캐러셀 */}
        <ImageCarousel images={carouselImages} />

        <div className="px-4 space-y-4 pt-5">
          {/* 업체명 + 카테고리 + 소개 */}
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {categoryLabels.length > 0 ? categoryLabels.map((label) => (
                <span key={label} className="inline-flex items-center h-6 px-2.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                  {label}
                </span>
              )) : (
                <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">기타</span>
              )}
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">{partnerName}</h1>
            {profile.intro && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{String(profile.intro)}</p>
            )}
          </div>

          {/* 혜택 안내 — 강조 섹션 */}
          {benefitText && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
              <div className="px-5 py-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span
                    className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-black text-white"
                    style={{ background: "oklch(0.52 0.27 264)" }}
                  >
                    ✦ 포인트 혜택
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-line">
                  {benefitText}
                </p>
              </div>
            </div>
          )}

          {/* 업체 정보 */}
          <div className="bg-card shadow-card rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-1">
              <h2 className="text-sm font-black text-foreground">업체 정보</h2>
            </div>
            <div className="px-5 pb-2">
              {address && (
                <div className="flex items-start gap-3 py-3 border-b border-border/50">
                  <span className="text-xs font-bold text-muted-foreground w-14 shrink-0 pt-0.5">주소</span>
                  <span className="text-sm text-foreground">{address}</span>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-3 py-3 border-b border-border/50">
                  <span className="text-xs font-bold text-muted-foreground w-14 shrink-0">전화번호</span>
                  <a href={`tel:${phone}`} className="text-sm text-foreground font-semibold hover:text-primary transition-colors">{phone}</a>
                </div>
              )}
              {kakaoChannelUrl && (
                <div className="flex items-center gap-3 py-3">
                  <span className="text-xs font-bold text-muted-foreground w-14 shrink-0">카카오채널</span>
                  <a href={kakaoChannelUrl} target="_blank" rel="noreferrer"
                    className="text-sm text-primary font-bold hover:underline underline-offset-2">
                    채널 바로가기 →
                  </a>
                </div>
              )}
              {!address && !phone && !kakaoChannelUrl && (
                <p className="py-3 text-sm text-muted-foreground">등록된 업체 정보가 없습니다.</p>
              )}
            </div>
          </div>

          {/* 신청 섹션 */}
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
    </div>
  );
}
