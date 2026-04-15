"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CustomerShellClient from "./CustomerShellClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, RefreshCw, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type CategoryItem = { code: string; name: string };
type SessionInfo = { uid: string; username: string; name: string; role: string };

function formatPoint(value: number) {
  return Number(value || 0).toLocaleString();
}


export default function CategoryGridClient({ session }: { session: SessionInfo }) {
  const pathname = usePathname();
  const orgSlug = pathname.split('/')[1];
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/customer/onboarding", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          const interests: string[] = data.interests ?? [];
          const options: { value: string; label: string }[] = data.interestOptions ?? [];
          setCategories(
            interests.map((code) => ({
              code,
              name: options.find((o) => o.value === code)?.label ?? code,
            }))
          );
        }
      })
      .finally(() => setCatLoading(false));

    fetch("/api/me/balance", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setBalance(Number(data.balance ?? 0));
      })
      .finally(() => setBalanceLoading(false));
  }, []);

  async function refreshBalance() {
    setBalanceRefreshing(true);
    try {
      const res = await fetch("/api/me/balance", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setBalance(Number(data.balance ?? 0));
    } finally {
      setBalanceRefreshing(false);
    }
  }

  return (
    <CustomerShellClient session={session} title="둘러보기" hideTitle>
      <div className="space-y-5">
        {/* Balance Card */}
        <div
          className="relative rounded-2xl px-5 py-4 text-white overflow-hidden"
          style={{
            background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-15 pointer-events-none"
            style={{
              background: "radial-gradient(circle, white, transparent 70%)",
              transform: "translate(30%, -30%)",
            }}
          />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Coins className="w-3.5 h-3.5 opacity-75" />
                <span className="text-xs font-semibold opacity-75">{session.name?.trim() || session.username || "고객"}님의 포인트</span>
              </div>
              {balanceLoading ? (
                <Skeleton className="h-8 w-32 bg-white/20" />
              ) : (
                <div
                  className="font-black leading-none"
                  style={{ fontSize: "1.75rem", letterSpacing: "-0.04em" }}
                >
                  {formatPoint(balance)}
                  <span className="text-lg ml-1 opacity-80">P</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={refreshBalance}
              disabled={balanceRefreshing || balanceLoading}
              className="flex items-center gap-1 text-white/60 hover:text-white/90 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn("w-4 h-4", balanceRefreshing && "animate-spin")} />
              <span className="text-xs font-semibold">새로고침</span>
            </button>
          </div>
        </div>

        {/* Category Grid */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-foreground">카테고리</h2>
            <Link
              href={`/${orgSlug}/customer/interests`}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              관심사 편집
            </Link>
          </div>

          {catLoading ? (
            <div className="grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 sm:h-28 rounded-xl sm:rounded-2xl" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-2xl bg-muted/40 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-2">
                설정된 관심 카테고리가 없습니다.
              </p>
              <Link href={`/${orgSlug}/customer/interests`} className="text-sm font-bold text-primary hover:underline">
                관심사 설정하기 →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((cat) => (
                <Link
                  key={cat.code}
                  href={`/${orgSlug}/customer/category/${cat.code}`}
                  className="flex flex-col items-center justify-center h-20 sm:h-28 rounded-xl sm:rounded-2xl gap-1 bg-muted/60 hover:bg-muted active:scale-95 transition-all duration-150"
                >
                  <span className="text-sm font-bold text-foreground">{cat.name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </CustomerShellClient>
  );
}
