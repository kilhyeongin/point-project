"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CustomerShellClient from "@/app/[orgSlug]/customer/CustomerShellClient";
import FavoritePartnerButton from "@/app/[orgSlug]/customer/FavoritePartnerButton";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Search, MapPin, Phone } from "lucide-react";

type SessionInfo = { uid: string; username: string; name: string; role: string };

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
};

type Props = {
  session: SessionInfo;
  categoryCode: string;
  categoryName: string;
};

// 1개일 때 풀너비 카드
function FullCard({
  item,
  onFavoriteChanged,
  orgSlug,
}: {
  item: PartnerItem;
  onFavoriteChanged?: (partnerId: string, next: boolean) => void;
  orgSlug: string;
}) {
  const imageUrl = item.coverImageUrl?.trim();
  return (
    <article className="bg-card rounded-2xl overflow-hidden flex flex-col shadow-card hover:shadow-card-hover transition-all duration-200">
      <div className="w-full aspect-video bg-muted overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-semibold">이미지 없음</div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-black text-foreground leading-tight">{item.name}</h3>
          <FavoritePartnerButton
            partnerId={item.id}
            initialFavorite={Boolean(item.isFavorite)}
            onChanged={(next) => onFavoriteChanged?.(item.id, next)}
          />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {item.intro || "등록된 소개글이 없습니다."}
        </p>
        {item.benefitText && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
            <div className="text-xs font-bold text-primary mb-1">제공 혜택</div>
            <p className="text-sm text-foreground font-semibold leading-relaxed whitespace-pre-line line-clamp-5">
              {item.benefitText}
            </p>
          </div>
        )}
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
        <div className="mt-auto pt-1">
          <Link href={`/${orgSlug}/customer/partner/${item.id}`} className={cn(buttonVariants({}), "w-full h-[45px]")}>
            상세 보기
          </Link>
        </div>
      </div>
    </article>
  );
}

// 2개 이상일 때 2열 컴팩트 카드
function GridCard({
  item,
  onFavoriteChanged,
  orgSlug,
}: {
  item: PartnerItem;
  onFavoriteChanged?: (partnerId: string, next: boolean) => void;
  orgSlug: string;
}) {
  const imageUrl = item.coverImageUrl?.trim();
  return (
    <article className="bg-card rounded-2xl overflow-hidden flex flex-col shadow-card hover:shadow-card-hover transition-all duration-200">
      <div className="w-full aspect-square bg-muted overflow-hidden relative">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-semibold">이미지 없음</div>
        )}
        <div className="absolute top-2 right-2">
          <FavoritePartnerButton
            partnerId={item.id}
            initialFavorite={Boolean(item.isFavorite)}
            onChanged={(next) => onFavoriteChanged?.(item.id, next)}
            onImage
          />
        </div>
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="text-sm font-black text-foreground leading-tight line-clamp-1">{item.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {item.intro || "등록된 소개글이 없습니다."}
        </p>
        <div className="mt-auto pt-2 flex flex-col gap-1.5">
          {item.benefitText && (
            <span className="inline-block text-[11px] font-bold text-primary bg-primary/8 rounded-md px-2 py-0.5 line-clamp-1">
              ✦ 혜택 있음
            </span>
          )}
          <Link href={`/${orgSlug}/customer/partner/${item.id}`} className={cn(buttonVariants({ size: "sm" }), "w-full h-10")}>
            상세 보기
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function CategoryPartnersClient({ session, categoryCode, categoryName }: Props) {
  const pathname = usePathname();
  const orgSlug = pathname.split('/')[1];

  const [items, setItems] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  async function loadPartners(q: string) {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/customer/partners", window.location.origin);
      url.searchParams.set("category", categoryCode);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setItems([]);
        setError(data?.error ?? "업체 목록을 불러오지 못했습니다.");
        return;
      }
      const shuffled = [...(data.items ?? [])].sort(() => Math.random() - 0.5);
      setItems(shuffled);
    } catch {
      setItems([]);
      setError("업체 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPartners(submittedSearch);
  }, [submittedSearch]);

  function onSubmitSearch(e: FormEvent) {
    e.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function resetSearch() {
    setSearch("");
    setSubmittedSearch("");
    setSearchOpen(false);
  }

  function handleFavoriteChanged(partnerId: string, next: boolean) {
    setItems((prev) =>
      prev.map((item) => (item.id === partnerId ? { ...item, isFavorite: next } : item))
    );
  }

  const searchButton = !searchOpen ? (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="flex items-center justify-center w-9 h-9 rounded-xl text-foreground hover:bg-muted transition-colors"
    >
      <Search className="w-5 h-5" />
    </button>
  ) : null;

  return (
    <CustomerShellClient
      session={session}
      title={categoryName}
      backHref={`/${orgSlug}/customer`}
      headerRight={searchButton}
    >
      <div className="space-y-4">
        {/* 검색창 (열렸을 때만 표시) */}
        {searchOpen && (
          <form onSubmit={onSubmitSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`${categoryName} 업체 검색`}
                className="pl-9 h-11"
                autoFocus
              />
            </div>
            <Button type="button" variant="outline" onClick={resetSearch} className="h-11 shrink-0">
              취소
            </Button>
            <Button type="submit" className="h-11 shrink-0">검색</Button>
          </form>
        )}

        {/* Count */}
        {!loading && (
          <p className="text-xs text-muted-foreground font-semibold">
            {submittedSearch ? `"${submittedSearch}" 검색 결과 ` : ""}{items.length}개
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Partner list */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-card shadow-card">
                <Skeleton className="w-full aspect-video" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl bg-muted/40">
            <p className="text-muted-foreground text-sm font-semibold">
              {submittedSearch ? "검색 조건에 맞는 업체가 없습니다." : `${categoryName} 카테고리의 업체가 없습니다.`}
            </p>
          </div>
        ) : items.length === 1 ? (
          <FullCard item={items[0]} onFavoriteChanged={handleFavoriteChanged} orgSlug={orgSlug} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <GridCard key={item.id} item={item} onFavoriteChanged={handleFavoriteChanged} orgSlug={orgSlug} />
            ))}
          </div>
        )}
      </div>
    </CustomerShellClient>
  );
}
