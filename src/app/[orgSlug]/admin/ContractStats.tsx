"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type MonthStat = { year: number; month: number; count: number };

type Props = {
  todayCount: number;
  monthlyStats: MonthStat[];
};

function fmt(n: number) {
  return Number(n || 0).toLocaleString();
}

export default function ContractStats({ todayCount, monthlyStats }: Props) {
  const [idx, setIdx] = useState(0);
  const current = monthlyStats[idx];

  return (
    <div className="bg-muted/50 rounded-2xl px-4 py-3 flex-[3] min-w-0">
      <p className="text-xs sm:text-sm text-muted-foreground font-semibold mb-3">계약현황</p>

      <div className="flex items-stretch w-full">
        {/* 오늘 계약 — 40% */}
        <div className="w-2/5 flex flex-col items-center justify-center shrink-0">
          <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight leading-none mb-1">
            {fmt(todayCount)}<span className="text-sm sm:text-lg font-bold ml-0.5">건</span>
          </p>
          <p className="text-[10px] sm:text-sm text-muted-foreground font-medium whitespace-nowrap">오늘 계약</p>
        </div>

        {/* 구분선 */}
        <div className="w-px bg-border mx-2 shrink-0" />

        {/* 월별 계약 — 나머지 */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
          <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight leading-none mb-1">
            {current ? fmt(current.count) : "0"}<span className="text-sm sm:text-lg font-bold ml-0.5">건</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIdx((i) => Math.min(i + 1, monthlyStats.length - 1))}
              disabled={idx >= monthlyStats.length - 1}
              className="disabled:opacity-25 transition-opacity shrink-0"
            >
              <ChevronLeft className="w-4 h-4 text-black dark:text-white stroke-[3]" />
            </button>
            <span className="text-[10px] sm:text-sm font-medium text-muted-foreground text-center truncate">
              {current ? `${current.month}월 계약` : "-"}
            </span>
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(i - 1, 0))}
              disabled={idx <= 0}
              className="disabled:opacity-25 transition-opacity shrink-0"
            >
              <ChevronRight className="w-4 h-4 text-black dark:text-white stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
