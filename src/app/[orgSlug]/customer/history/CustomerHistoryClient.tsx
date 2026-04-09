"use client";

import { useEffect, useState } from "react";
import CustomerShellClient from "@/app/[orgSlug]/customer/CustomerShellClient";

type SessionInfo = {
  uid: string;
  username: string;
  name: string;
  role: string;
};

type LedgerItem = {
  id: string;
  type: string;
  amount: number;
  note: string;
  refType: string | null;
  partnerName: string | null;
  createdAt: string;
};

function typeLabel(type: string, hasPartner = false) {
  if (type === "TOPUP") return "포인트 충전";
  if (type === "ISSUE") return hasPartner ? "고객에게 포인트 지급" : "포인트 지급";
  if (type === "USE") return "포인트 사용";
  if (type === "ADJUST") return "포인트 조정";
  return type;
}

function typeColor(type: string) {
  if (type === "TOPUP" || type === "ISSUE") return "oklch(0.45 0.2 145)"; // green
  if (type === "USE") return "oklch(0.5 0.22 25)"; // red
  if (type === "ADJUST") return "oklch(0.5 0.18 264)"; // blue
  return "oklch(0.5 0 0)";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CustomerHistoryClient({ session }: { session: SessionInfo }) {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/me/ledger", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setItems(Array.isArray(data.items) ? data.items : []);
        else setError(data.message ?? "불러오기 실패");
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, []);

  const totalBalance = items.reduce((acc, item) => {
    if (item.type === "TOPUP" || item.type === "ISSUE") return acc + item.amount;
    if (item.type === "USE" || item.type === "ADJUST") return acc - Math.abs(item.amount);
    return acc;
  }, 0);

  return (
    <CustomerShellClient
      session={session}
      title="포인트 내역"
      description="최근 100건의 포인트 거래 내역입니다."
    >
      <div className="space-y-4">
        {/* Summary card */}
        <div
          className="rounded-2xl p-5 text-white"
          style={{
            background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.42 0.25 280) 100%)",
          }}
        >
          <p className="text-sm font-semibold opacity-80">현재 잔액</p>
          <p className="text-3xl font-black mt-1 tracking-tight">
            {Number(totalBalance || 0).toLocaleString()}P
          </p>
        </div>

        {/* List */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card shadow-card rounded-2xl p-4 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-3 w-24 bg-muted rounded-full" />
                    <div className="h-3 w-32 bg-muted rounded-full" />
                  </div>
                  <div className="h-4 w-16 bg-muted rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            아직 포인트 내역이 없습니다.
          </div>
        )}

        {!loading && items.map((item) => {
          const isPositive = item.type === "TOPUP" || item.type === "ISSUE";
          const sign = isPositive ? "+" : "-";
          return (
            <div key={item.id} className="bg-card shadow-card rounded-2xl p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-foreground">
                    {item.partnerName
                      ? `${item.partnerName}에서 ${typeLabel(item.type, true)}`
                      : typeLabel(item.type)}
                  </p>
                  {!item.partnerName && item.note && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(item.createdAt)}</p>
                </div>
                <span
                  className="text-base font-black whitespace-nowrap"
                  style={{ color: typeColor(item.type) }}
                >
                  {sign}{Math.abs(item.amount).toLocaleString()}P
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </CustomerShellClient>
  );
}
