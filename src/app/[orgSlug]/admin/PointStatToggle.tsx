"use client";

import { useState } from "react";

type Props = {
  todayUse: number;
  todayIssue: number;
  monthUse: number;
  monthIssue: number;
};

function fmt(n: number) {
  return Number(n || 0).toLocaleString();
}

const TABS = [
  { key: "todayUse", label: "오늘 사용" },
  { key: "todayIssue", label: "오늘 지급" },
  { key: "monthUse", label: "이번달 사용" },
  { key: "monthIssue", label: "이번달 지급" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function PointStatToggle({ todayUse, todayIssue, monthUse, monthIssue }: Props) {
  const [active, setActive] = useState<TabKey>("todayUse");

  const valueMap: Record<TabKey, number> = { todayUse, todayIssue, monthUse, monthIssue };
  const labelMap: Record<TabKey, string> = {
    todayUse: "오늘 사용 포인트",
    todayIssue: "오늘 지급 포인트",
    monthUse: "이번달 사용 포인트",
    monthIssue: "이번달 지급 포인트",
  };

  const buttons = (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => setActive(tab.key)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
            active === tab.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="bg-card shadow-card rounded-2xl px-5 py-4">
      {/* 데스크탑: 타이틀·버튼 한 줄 / 모바일: 타이틀만 */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">포인트 사용내역</p>
        <div className="hidden sm:flex">{buttons}</div>
      </div>

      <div className="flex items-baseline gap-2">
        <p className="text-sm text-muted-foreground font-medium">{labelMap[active]}</p>
        <p className="text-2xl font-black text-foreground tracking-tight">
          {fmt(valueMap[active])}<span className="text-base font-bold">P</span>
        </p>
      </div>

      {/* 모바일: 버튼을 맨 아래 */}
      <div className="flex sm:hidden mt-3">{buttons}</div>
    </div>
  );
}
