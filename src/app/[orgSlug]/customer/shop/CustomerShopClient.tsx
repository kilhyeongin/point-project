"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import CustomerShellClient from "../CustomerShellClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ClipboardList, Coins, X, CheckCircle, AlertCircle } from "lucide-react";

type SessionInfo = { uid: string; username: string; name: string; role: string };

type Product = {
  id: string;
  name: string;
  brand: string;
  description: string;
  pointCost: number;
  imageUrl: string;
  expirationDays: number;
};

function formatPoint(value: number) {
  return Number(value || 0).toLocaleString();
}

function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const BRAND_COLORS: Record<string, string> = {
  "네이버페이": "#03C75A",
  "카카오페이": "#FEE500",
  "스타벅스": "#006241",
  "배달의민족": "#2AC1BC",
  "쿠팡": "#EE2222",
  "CU": "#6E2FF4",
  "GS25": "#0B5CA8",
  "세븐일레븐": "#007DC5",
};

function BrandBadge({ brand }: { brand: string }) {
  const color = BRAND_COLORS[brand];
  return (
    <span
      className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full"
      style={
        color
          ? { background: color + "22", color }
          : { background: "oklch(0.93 0.01 250)", color: "oklch(0.4 0.01 250)" }
      }
    >
      {brand}
    </span>
  );
}

export default function CustomerShopClient({ session }: { session: SessionInfo }) {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [selected, setSelected] = useState<Product | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    pinNumber?: string;
    pinUrl?: string;
    error?: string;
  } | null>(null);

  const fetchBalance = useCallback(() => {
    setBalanceLoading(true);
    fetch("/api/me/balance", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setBalance(Number(data.balance ?? 0));
      })
      .finally(() => setBalanceLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/customer/shop/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setProducts(Array.isArray(data.items) ? data.items : []);
      })
      .finally(() => setLoading(false));

    fetchBalance();
  }, [fetchBalance]);

  async function handlePurchase() {
    if (!selected || purchasing) return;

    setPurchasing(true);
    setResult(null);

    try {
      const res = await fetch("/api/customer/shop/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          idempotencyKey: generateIdempotencyKey(),
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setResult({ ok: true, pinNumber: data.pinNumber, pinUrl: data.pinUrl });
        fetchBalance();
      } else {
        setResult({ ok: false, error: data.error ?? "구매 실패" });
      }
    } catch {
      setResult({ ok: false, error: "네트워크 오류가 발생했습니다." });
    } finally {
      setPurchasing(false);
    }
  }

  function closeModal() {
    setSelected(null);
    setResult(null);
  }

  return (
    <CustomerShellClient
      session={session}
      title="상품몰"
      description="포인트로 상품권을 구매하세요"
    >
      {/* 잔액 카드 */}
      <div
        className="relative rounded-2xl px-5 py-4 text-white overflow-hidden mb-5"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-semibold mb-1">보유 포인트</p>
            {balanceLoading ? (
              <Skeleton className="h-8 w-28 bg-white/20" />
            ) : (
              <p className="text-3xl font-black tracking-tight">
                {formatPoint(balance)}
                <span className="text-base font-bold ml-1">P</span>
              </p>
            )}
          </div>
          <Link
            href={`/${orgSlug}/customer/shop/orders`}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-2 text-white text-xs font-bold"
          >
            <ClipboardList className="w-4 h-4" />
            구매내역
          </Link>
        </div>
      </div>

      {/* 상품 목록 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-base font-bold text-muted-foreground">등록된 상품이 없습니다</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            곧 다양한 상품이 추가될 예정입니다
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => { setSelected(product); setResult(null); }}
              className="text-left bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all active:scale-95"
            >
              {product.imageUrl ? (
                <div className="w-full h-28 bg-muted overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-full h-28 flex items-center justify-center"
                  style={{ background: "oklch(0.96 0.01 250)" }}
                >
                  <ShoppingBag className="w-10 h-10 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-3">
                <BrandBadge brand={product.brand} />
                <p className="text-sm font-bold text-foreground mt-1.5 leading-tight line-clamp-2">
                  {product.name}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <Coins className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-black text-primary">
                    {formatPoint(product.pointCost)}P
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 구매 확인 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-sm bg-background rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl mx-4 mb-0 sm:mb-4">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {result ? (
              /* 결과 화면 */
              result.ok ? (
                <div className="flex flex-col items-center text-center py-2">
                  <CheckCircle className="w-14 h-14 text-green-500 mb-3" />
                  <p className="text-lg font-black text-foreground mb-1">구매 완료!</p>
                  <p className="text-sm text-muted-foreground mb-5">
                    상품권 핀번호를 확인하세요
                  </p>
                  <div className="w-full bg-muted rounded-2xl p-4 mb-5">
                    <p className="text-xs text-muted-foreground font-semibold mb-1">핀번호</p>
                    <p className="text-xl font-black text-foreground tracking-widest">
                      {result.pinNumber}
                    </p>
                    {result.pinUrl && (
                      <a
                        href={result.pinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary font-bold underline mt-2 block"
                      >
                        바로 사용하기
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-5">
                    유효기간 {selected.expirationDays}일 · 구매내역에서 다시 확인 가능
                  </p>
                  <Button onClick={closeModal} className="w-full rounded-xl font-bold">
                    확인
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-2">
                  <AlertCircle className="w-14 h-14 text-destructive mb-3" />
                  <p className="text-lg font-black text-foreground mb-1">구매 실패</p>
                  <p className="text-sm text-muted-foreground mb-5">{result.error}</p>
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    className="w-full rounded-xl font-bold"
                  >
                    닫기
                  </Button>
                </div>
              )
            ) : (
              /* 구매 확인 화면 */
              <>
                <p className="text-lg font-black text-foreground mb-1">구매 확인</p>
                <p className="text-sm text-muted-foreground mb-5">
                  아래 상품을 포인트로 구매합니다
                </p>

                <div className="bg-muted rounded-2xl p-4 mb-5">
                  <div className="flex items-start gap-3">
                    {selected.imageUrl ? (
                      <img
                        src={selected.imageUrl}
                        alt={selected.name}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-background flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-7 h-7 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <BrandBadge brand={selected.brand} />
                      <p className="text-sm font-bold text-foreground mt-1 leading-tight">
                        {selected.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        유효기간 {selected.expirationDays}일
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <span className="text-sm text-muted-foreground font-semibold">차감 포인트</span>
                    <span className="text-base font-black text-primary">
                      -{formatPoint(selected.pointCost)}P
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-muted-foreground font-semibold">구매 후 잔액</span>
                    <span
                      className={`text-base font-black ${
                        balance - selected.pointCost < 0
                          ? "text-destructive"
                          : "text-foreground"
                      }`}
                    >
                      {formatPoint(Math.max(0, balance - selected.pointCost))}P
                    </span>
                  </div>
                </div>

                {balance < selected.pointCost && (
                  <div className="flex items-center gap-2 bg-destructive/10 rounded-xl px-4 py-3 mb-4">
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    <p className="text-xs font-bold text-destructive">
                      포인트가 부족합니다 (보유 {formatPoint(balance)}P)
                    </p>
                  </div>
                )}

                <Button
                  onClick={handlePurchase}
                  disabled={purchasing || balance < selected.pointCost}
                  className="w-full rounded-xl font-black text-base h-12"
                >
                  {purchasing ? "처리 중..." : `${formatPoint(selected.pointCost)}P로 구매하기`}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </CustomerShellClient>
  );
}
