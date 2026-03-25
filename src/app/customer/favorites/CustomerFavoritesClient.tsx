"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CustomerShellClient from "../CustomerShellClient";
import FavoritePartnerButton from "../FavoritePartnerButton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Phone, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type SessionInfo = {
  uid: string;
  username: string;
  name: string;
  role: string;
};

type FavoritePartnerItem = {
  id: string;
  username: string;
  name: string;
  category: string;
  categories?: string[];
  categoryLabels?: string[];
  intro: string;
  benefitText: string;
  kakaoChannelUrl?: string;
  applyUrl?: string;
  address: string;
  phone: string;
  coverImageUrl: string;
  isFavorite?: boolean;
};

type FavoritesResponse = {
  ok: boolean;
  items?: FavoritePartnerItem[];
  message?: string;
  error?: string;
};

type Props = {
  session: SessionInfo;
};

function PartnerCard({
  item,
  onFavoriteChanged,
}: {
  item: FavoritePartnerItem;
  onFavoriteChanged?: (partnerId: string, next: boolean) => void;
}) {
  const imageUrl = item.coverImageUrl?.trim();
  const [benefitExpanded, setBenefitExpanded] = useState(false);
  const BENEFIT_LINES = 5;
  const benefitLineCount = (item.benefitText || "").split("\n").length;
  const benefitLong = benefitLineCount > BENEFIT_LINES || (item.benefitText || "").length > 120;

  return (
    <article className="bg-card shadow-card rounded-2xl overflow-hidden flex flex-col hover:shadow-card-hover transition-shadow">
      <div className="w-full aspect-video bg-muted overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-semibold">
            이미지 없음
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {item.categoryLabels && item.categoryLabels.length > 0 ? (
                item.categoryLabels.map((label) => (
                  <Badge key={`${item.id}-${label}`} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {item.category || "기타"}
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-black text-foreground leading-tight">
              {item.name}
            </h3>
          </div>
          <FavoritePartnerButton
            partnerId={item.id}
            initialFavorite={Boolean(item.isFavorite)}
            onChanged={(next) => onFavoriteChanged?.(item.id, next)}
          />
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {item.intro || "등록된 소개글이 없습니다."}
        </p>

        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
          <div className="text-xs font-bold text-primary mb-1">제공 혜택</div>
          <p className={cn("text-sm text-foreground font-semibold leading-relaxed whitespace-pre-line", !benefitExpanded && "overflow-hidden max-h-[7.1rem]")}>
            {item.benefitText || "등록된 혜택이 없습니다."}
          </p>
          {benefitLong && (
            <button
              type="button"
              onClick={() => setBenefitExpanded((v) => !v)}
              className="mt-1.5 text-xs font-bold text-primary hover:underline"
            >
              {benefitExpanded ? "접기" : "더보기"}
            </button>
          )}
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{item.address || "주소 미등록"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>{item.phone || "연락처 미등록"}</span>
          </div>
        </div>

        <div className="mt-auto pt-1">
          <Link
            href={`/customer/partner/${item.id}`}
            className={cn(buttonVariants({ size: "sm" }), "w-full")}
          >
            상세 보기
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function CustomerFavoritesClient({ session }: Props) {
  const [items, setItems] = useState<FavoritePartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function loadFavorites() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/customer/favorites/list", { cache: "no-store" });
      const data: FavoritesResponse = await res.json();
      if (!res.ok || !data?.ok) {
        setItems([]);
        setMsg(data?.error ?? data?.message ?? "관심업체를 불러오지 못했습니다.");
        return;
      }
      setItems((data.items ?? []).map((item) => ({ ...item, isFavorite: true })));
    } catch {
      setItems([]);
      setMsg("관심업체를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFavorites();
  }, []);

  function handleFavoriteChanged(partnerId: string, next: boolean) {
    if (!next) {
      setItems((prev) => prev.filter((item) => item.id !== partnerId));
      return;
    }
    setItems((prev) =>
      prev.map((item) => item.id === partnerId ? { ...item, isFavorite: next } : item)
    );
  }

  return (
    <CustomerShellClient
      session={session}
      title="관심업체"
      description="저장해둔 제휴사를 한곳에서 모아보고 다시 확인할 수 있습니다."
    >
      <div className="space-y-5">
        {/* Back link */}
        <Link
          href="/customer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          전체 제휴사 보기
        </Link>

        {/* List */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-foreground">저장한 관심업체</h2>
            {!loading && (
              <span className="text-xs text-muted-foreground font-semibold">
                {items.length}개
              </span>
            )}
          </div>

          {msg && (
            <div className="mb-3 p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
              {msg}
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shadow-card rounded-2xl overflow-hidden bg-card">
                  <Skeleton className="w-full aspect-video" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl bg-muted/40">
              <p className="text-muted-foreground text-sm font-semibold">
                저장한 관심업체가 없습니다.
              </p>
              <Link href="/customer" className="mt-3 text-primary text-sm font-bold hover:underline">
                제휴사 둘러보기 →
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {items.map((item) => (
                <PartnerCard
                  key={item.id}
                  item={item}
                  onFavoriteChanged={handleFavoriteChanged}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </CustomerShellClient>
  );
}
