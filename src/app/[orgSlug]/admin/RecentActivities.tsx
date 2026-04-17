"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  type: string;
  amount: number;
  createdAt: unknown;
  account: { name: string } | null;
  counterparty: { name: string } | null;
  actor: { name: string } | null;
};

const LEDGER_TYPE_LABEL: Record<string, string> = {
  TOPUP: "충전",
  ISSUE: "지급",
  USE: "사용",
  ADJUST: "조정",
};

function formatKrDateTime(v: unknown) {
  if (!v) return "-";
  const d = new Date(v as string);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${yy}.${mm}.${dd} ${ampm}${h12}시${min}분`;
}

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

export default function RecentActivities({ activities }: { activities: Activity[] }) {
  const [visibleCount, setVisibleCount] = useState(3);

  const visible = activities.slice(0, visibleCount);
  const hasMore = visibleCount < activities.length;

  return (
    <div className="bg-card shadow-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-foreground">최근 거래 내역</h2>
        <span className="text-xs text-muted-foreground font-semibold">{activities.length}건 중 {visible.length}건</span>
      </div>

      <div className="space-y-0">
        {visible.length > 0 ? (
          visible.map((r) => (
            <div
              key={r.id}
              className="flex items-center py-3 border-b border-border last:border-0 gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge
                    className={cn(
                      "text-[10px] font-black",
                      r.type === "ISSUE" && "bg-blue-100 text-blue-700 border-blue-200",
                      r.type === "USE" && "bg-violet-100 text-violet-700 border-violet-200",
                      r.type === "TOPUP" && "bg-emerald-100 text-emerald-700 border-emerald-200",
                      r.type !== "ISSUE" && r.type !== "USE" && r.type !== "TOPUP" && "bg-muted text-muted-foreground"
                    )}
                    variant="outline"
                  >
                    {LEDGER_TYPE_LABEL[r.type] ?? r.type}
                  </Badge>
                  <span className="text-sm font-bold text-foreground truncate">
                    {r.account?.name ?? "계정 정보 없음"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {r.counterparty?.name ?? r.actor?.name ?? "상대 정보 없음"}
                  {" · "}
                  {formatKrDateTime(r.createdAt)}
                </p>
              </div>
              <span className="text-base font-black text-foreground whitespace-nowrap shrink-0">
                {formatNumber(Math.abs(r.amount))}P
              </span>
            </div>
          ))
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            최근 활동이 없습니다.
          </div>
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + 3)}
          className="mt-3 w-full py-2 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border transition-colors"
        >
          더보기 ({activities.length - visibleCount}건 남음)
        </button>
      )}
    </div>
  );
}
