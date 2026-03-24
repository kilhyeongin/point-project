"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CustomerShellClient from "./CustomerShellClient";
import FavoritePartnerButton from "./FavoritePartnerButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MapPin, Phone, Search, X, Star, Coins } from "lucide-react";

type SessionInfo = {
  uid: string;
  username: string;
  name: string;
  role: string;
};

type PartnerItem = {
  id: string;
  name: string;
  category: string;
  categories?: string[];
  categoryLabels?: string[];
  intro: string;
  benefitText: string;
  address: string;
  detailAddress?: string;
  phone: string;
  coverImageUrl: string;
  isFavorite?: boolean;
  score?: number;
  matchedInterests?: string[];
  matchedInterestLabels?: string[];
};

type BalanceResponse = {
  ok: boolean;
  balance?: number;
  message?: string;
  error?: string;
};

type PartnersResponse = {
  ok: boolean;
  items?: PartnerItem[];
  message?: string;
  error?: string;
};

type RecommendationResponse = {
  ok: boolean;
  onboardingCompleted?: boolean;
  interests?: string[];
  interestLabels?: string[];
  items?: PartnerItem[];
  message?: string;
  error?: string;
};

type Props = {
  session: SessionInfo;
};

function formatPoint(value: number) {
  return Number(value || 0).toLocaleString();
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl bg-muted/40">
      <p className="text-muted-foreground text-sm font-semibold">{text}</p>
    </div>
  );
}

function PartnerCard({
  item,
  onFavoriteChanged,
  recommendationMode = false,
}: {
  item: PartnerItem;
  onFavoriteChanged?: (partnerId: string, next: boolean) => void;
  recommendationMode?: boolean;
}) {
  const imageUrl = item.coverImageUrl?.trim();

  return (
    <article className="bg-card rounded-2xl overflow-hidden flex flex-col shadow-card hover:shadow-card-hover transition-all duration-200">
      {/* Cover image */}
      <div className="w-full aspect-video bg-muted overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-semibold">
            이미지 없음
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Category badges */}
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
              {recommendationMode && item.matchedInterestLabels?.map((label) => (
                <Badge key={`${item.id}-matched-${label}`} className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                  <Star className="w-2.5 h-2.5 mr-1" />
                  {label}
                </Badge>
              ))}
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

        {/* Intro */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {item.intro || "등록된 소개글이 없습니다."}
        </p>

        {/* Benefit */}
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
          <div className="text-xs font-bold text-primary mb-1">제공 혜택</div>
          <p className="text-sm text-foreground font-semibold leading-relaxed">
            {item.benefitText || "등록된 혜택이 없습니다."}
          </p>
        </div>

        {/* Location & contact */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{[item.address, item.detailAddress].filter(Boolean).join(" ") || "주소 미등록"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>{item.phone || "연락처 미등록"}</span>
          </div>
        </div>

        {/* Action */}
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

export default function CustomerDashboardClient({ session }: Props) {
  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState("");

  const [items, setItems] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [recommendItems, setRecommendItems] = useState<PartnerItem[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(true);
  const [recommendError, setRecommendError] = useState("");
  const [interestLabels, setInterestLabels] = useState<string[]>([]);

  const [tab, setTab] = useState<"ALL" | "FAVORITES">("ALL");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  async function loadBalance() {
    setBalanceLoading(true);
    setBalanceError("");
    try {
      const res = await fetch("/api/me/balance", { cache: "no-store" });
      const data: BalanceResponse = await res.json();
      if (!res.ok || !data?.ok) {
        setBalance(0);
        setBalanceError(data?.error ?? data?.message ?? "불러오지 못했습니다.");
        return;
      }
      setBalance(Number(data.balance ?? 0));
    } catch {
      setBalance(0);
      setBalanceError("보유 포인트를 불러오지 못했습니다.");
    } finally {
      setBalanceLoading(false);
    }
  }

  async function loadRecommendations() {
    setRecommendLoading(true);
    setRecommendError("");
    try {
      const res = await fetch("/api/customer/recommendations?limit=6", { cache: "no-store" });
      const data: RecommendationResponse = await res.json();
      if (!res.ok || !data?.ok) {
        setRecommendItems([]);
        setInterestLabels([]);
        setRecommendError(data?.error ?? data?.message ?? "추천 업체를 불러오지 못했습니다.");
        return;
      }
      setRecommendItems(data.items ?? []);
      setInterestLabels(data.interestLabels ?? []);
    } catch {
      setRecommendItems([]);
      setInterestLabels([]);
      setRecommendError("추천 업체를 불러오지 못했습니다.");
    } finally {
      setRecommendLoading(false);
    }
  }

  async function loadPartners(nextTab: "ALL" | "FAVORITES", q: string) {
    setLoading(true);
    setMsg("");
    try {
      const url = new URL(
        nextTab === "FAVORITES"
          ? "/api/customer/favorites/list"
          : "/api/customer/partners",
        window.location.origin
      );
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
      const data: PartnersResponse = await res.json();
      if (!res.ok || !data?.ok) {
        setItems([]);
        setMsg(data?.error ?? data?.message ?? "업체 목록을 불러오지 못했습니다.");
        return;
      }
      const nextItems = (data.items ?? []).map((item) => ({
        ...item,
        isFavorite: nextTab === "FAVORITES" ? true : Boolean(item.isFavorite),
      }));
      setItems(nextItems);
    } catch {
      setItems([]);
      setMsg("업체 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBalance();
    loadRecommendations();
  }, []);

  useEffect(() => {
    loadPartners(tab, submittedSearch);
  }, [tab, submittedSearch]);

  function onSubmitSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function resetSearch() {
    setSearch("");
    setSubmittedSearch("");
  }

  function handleFavoriteChanged(partnerId: string, next: boolean) {
    setItems((prev) => {
      if (tab === "FAVORITES" && !next) return prev.filter((item) => item.id !== partnerId);
      return prev.map((item) => item.id === partnerId ? { ...item, isFavorite: next } : item);
    });
    setRecommendItems((prev) =>
      prev.map((item) => item.id === partnerId ? { ...item, isFavorite: next } : item)
    );
  }

  const favoriteCount = useMemo(() => items.filter((item) => item.isFavorite).length, [items]);

  const emptyText =
    tab === "FAVORITES"
      ? submittedSearch ? "검색 조건에 맞는 관심업체가 없습니다." : "저장한 관심업체가 없습니다."
      : submittedSearch ? "검색 조건에 맞는 업체가 없습니다." : "노출 중인 제휴사가 없습니다.";

  return (
    <CustomerShellClient
      session={session}
      title="제휴사 둘러보기"
      description="관심사에 맞는 제휴사를 확인하고 포인트를 활용하세요."
    >
      <div className="space-y-5">
        {/* Balance Card */}
        <div
          className="relative rounded-2xl p-6 text-white overflow-hidden"
          style={{
            background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)",
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
            style={{
              background: "radial-gradient(circle, white, transparent 70%)",
              transform: "translate(30%, -30%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10 pointer-events-none"
            style={{
              background: "radial-gradient(circle, white, transparent 70%)",
              transform: "translate(-30%, 30%)",
            }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-4 h-4 opacity-75" />
              <span className="text-sm font-semibold opacity-75">내 보유 포인트</span>
            </div>
            {balanceLoading ? (
              <Skeleton className="h-11 w-40 bg-white/20" />
            ) : balanceError ? (
              <p className="text-sm opacity-70">{balanceError}</p>
            ) : (
              <div
                className="font-black leading-none"
                style={{ fontSize: "2.5rem", letterSpacing: "-0.04em" }}
              >
                {formatPoint(balance)}<span className="text-2xl ml-1.5 opacity-80">P</span>
              </div>
            )}
            <div className="mt-5 flex items-center gap-2 flex-wrap">
              <span className="text-xs opacity-50 font-medium">관심사</span>
              {interestLabels.length > 0 ? (
                interestLabels.map((label) => (
                  <span key={label} className="text-xs bg-white/15 px-2.5 py-1 rounded-full font-semibold">
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-xs opacity-50">미설정</span>
              )}
              <Link
                href="/customer/onboarding"
                className="ml-auto text-xs font-bold opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity"
              >
                변경
              </Link>
            </div>
          </div>
        </div>

        {/* Recommended */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-foreground">추천 제휴사</h2>
            {!recommendLoading && (
              <span className="text-xs text-muted-foreground font-semibold">
                {recommendItems.length}개
              </span>
            )}
          </div>

          {recommendError && (
            <div className="mb-3 p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
              {recommendError}
            </div>
          )}

          {recommendLoading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {[1, 2].map((i) => (
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
          ) : recommendItems.length === 0 ? (
            <EmptyState text="선택한 관심사와 일치하는 추천 업체가 없습니다." />
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {recommendItems.map((item) => (
                <PartnerCard
                  key={item.id}
                  item={item}
                  recommendationMode
                  onFavoriteChanged={handleFavoriteChanged}
                />
              ))}
            </div>
          )}
        </section>

        {/* Search & Filter */}
        <div className="space-y-3">
          <form onSubmit={onSubmitSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="업체명, 소개, 혜택, 주소로 검색"
                className="pl-9 h-11"
              />
            </div>
            {submittedSearch && (
              <Button type="button" variant="outline" size="icon" onClick={resetSearch} className="h-11 w-11 shrink-0">
                <X className="w-4 h-4" />
              </Button>
            )}
            <Button type="submit" className="h-11 shrink-0">검색</Button>
          </form>

          <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setTab("ALL")}
              className={`px-4 h-8 rounded-lg text-sm font-bold transition-all ${
                tab === "ALL"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              전체보기
            </button>
            <button
              type="button"
              onClick={() => setTab("FAVORITES")}
              className={`px-4 h-8 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${
                tab === "FAVORITES"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              관심업체
              {tab !== "FAVORITES" && favoriteCount > 0 && (
                <span className="bg-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {favoriteCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Partner list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-foreground">
              {tab === "FAVORITES" ? "관심업체" : "전체 제휴사"}
              {submittedSearch && (
                <span className="ml-2 text-sm font-semibold text-muted-foreground">
                  "{submittedSearch}" 검색 결과
                </span>
              )}
            </h2>
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
              {[1, 2, 3, 4].map((i) => (
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
            <EmptyState text={emptyText} />
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
