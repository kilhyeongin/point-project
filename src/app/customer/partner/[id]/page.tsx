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
import { Gift, MapPin, Phone, MessageCircle } from "lucide-react";

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

      <div className="max-w-2xl mx-auto pb-12">
        {/* Hero - 이미지 위에 이름/카테고리 오버레이 */}
        <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5">
          {coverImageUrl && (
            <img src={coverImageUrl} alt={partnerName} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {categoryLabels.length > 0 ? categoryLabels.map((label) => (
                <span key={label} className="inline-flex items-center h-5 px-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-bold border border-white/30">
                  {label}
                </span>
              )) : (
                <span className="inline-flex items-center h-5 px-2 rounded-full bg-white/20 text-white text-xs font-bold">기타</span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow">{partnerName}</h1>
            {profile.intro && (
              <p className="mt-1 text-sm text-white/80 leading-relaxed line-clamp-2">{String(profile.intro)}</p>
            )}
          </div>
        </div>

        <div className="px-4 pt-4 space-y-3">
          {/* 혜택 - 강조 섹션 */}
          {profile.benefitText && (
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/70" />
              <div className="relative px-5 py-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Gift className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-black text-white/80 tracking-widest uppercase">혜택</span>
                </div>
                <p className="text-sm font-semibold text-white leading-relaxed">{String(profile.benefitText)}</p>
              </div>
            </div>
          )}

          {/* 연락처 정보 */}
          {(address || profile.phone || profile.kakaoChannelUrl) && (
            <div className="bg-card shadow-card rounded-2xl overflow-hidden">
              {address && (
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-sm text-foreground">{address}</span>
                </div>
              )}
              {profile.phone && (
                <a href={`tel:${String(profile.phone)}`}
                  className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{String(profile.phone)}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-500">전화하기 →</span>
                </a>
              )}
              {profile.kakaoChannelUrl && (
                <a href={String(profile.kakaoChannelUrl)} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4 text-yellow-500" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">카카오채널</span>
                  </div>
                  <span className="text-xs font-bold text-yellow-600">바로가기 →</span>
                </a>
              )}
            </div>
          )}

          {/* Apply section */}
          <div className="bg-card shadow-card rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-black text-foreground">신청</h2>
            <div className={`p-3 rounded-xl border text-sm leading-relaxed ${
              applied
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : liked
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-muted border-border text-muted-foreground"
            }`}>
              <div className="font-bold mb-1">
                {applied ? "신청 완료" : liked ? "관심업체 저장 상태" : "아직 신청 전"}
              </div>
              <div>
                {applied
                  ? "이 제휴사에는 내 상세정보가 공개됩니다."
                  : "신청 후 이름·연락처·주소가 제휴사에 공개됩니다."}
              </div>
            </div>
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
