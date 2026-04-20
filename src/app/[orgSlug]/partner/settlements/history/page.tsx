"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Coins, FileText, ChevronLeft, ChevronRight } from "lucide-react";

// ── 타입 ─────────────────────────────────────────────────────

type PointSettlementItem = {
  id: string;
  periodKey: string;
  useCount: number;
  usedPoints: number;
  issuedPoints: number;
  issueCount: number;
  visitorCount: number;
  completedCount: number;
  cancelledCount: number;
  netPayable: number;
  status: string;
  paidAt?: string | null;
  note?: string;
};

type GeneralSettlementItem = {
  id: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  partnerName: string;
  columns: string[];
  rows: Array<{ cells: string[] }>;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  submittedAt: string | null;
  createdAt: string;
};

// ── 유틸 ─────────────────────────────────────────────────────

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function formatPeriod(periodKey: string) {
  const [year, month] = periodKey.split("-");
  return { year, month: String(Number(month)) };
}

// ── 포인트 정산 내역 ──────────────────────────────────────────

function PointStatusChip({ status }: { status: string }) {
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold";
  if (status === "PAID")
    return <span className={`${base} bg-foreground text-background`}>마감</span>;
  return <span className={`${base} bg-muted text-muted-foreground border border-border`}>집계중</span>;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

function PointHistoryTab() {
  const [items, setItems] = useState<PointSettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch("/api/partner/settlements")
      .then((r) => r.json())
      .then((data) => { if (data.ok) setItems(data.items); })
      .finally(() => setLoading(false));
  }, []);

  const it = items[currentIndex] ?? null;
  const total = items.length;

  if (loading) {
    return (
      <div className="bg-card shadow-card rounded-2xl p-6 animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-28 mx-auto" />
        {[1, 2, 3, 4, 5].map((j) => (
          <div key={j} className="h-10 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
        포인트 정산 내역이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-card shadow-card rounded-2xl overflow-hidden max-w-2xl">
      <div className="flex flex-col border-b border-border">
        {it && (
          <div className="flex justify-center pt-4">
            <PointStatusChip status={it.status} />
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.min(i + 1, total - 1))}
            disabled={currentIndex >= total - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground disabled:opacity-25 hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            {it && (() => {
              const { year, month } = formatPeriod(it.periodKey);
              return (
                <div className="flex items-baseline gap-1.5 justify-center">
                  <span className="text-sm text-muted-foreground font-semibold">{year}년</span>
                  <span className="text-2xl font-black text-foreground">{month}월</span>
                </div>
              );
            })()}
          </div>
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
            disabled={currentIndex <= 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground disabled:opacity-25 hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {it && (
        <>
          <div className="px-5 py-6 text-center border-b border-border">
            <p className="text-xs text-muted-foreground font-semibold mb-1">정산 지급액</p>
            <p className="text-4xl font-black text-foreground tracking-tight">
              {formatNumber(it.netPayable)}
              <span className="text-2xl ml-1 text-muted-foreground font-bold">P</span>
            </p>
            {it.paidAt && (
              <p className="text-xs text-muted-foreground mt-2">
                지급일 {new Date(it.paidAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="px-5 py-1">
            <StatRow label="방문 고객" value={`${formatNumber(it.visitorCount)}명`} />
            <StatRow label="포인트 지급" value={`${formatNumber(it.issuedPoints)}P`} />
            <StatRow label="포인트 사용" value={`${formatNumber(it.usedPoints)}P`} />
            <StatRow label="계약 완료" value={`${formatNumber(it.completedCount)}건`} />
            <StatRow label="방문 취소" value={`${formatNumber(it.cancelledCount)}건`} />
            <StatRow label="지급 횟수" value={`${formatNumber(it.issueCount)}회`} />
            <StatRow label="사용 횟수" value={`${formatNumber(it.useCount)}회`} />
            {it.note && <StatRow label="메모" value={it.note} />}
          </div>
        </>
      )}
    </div>
  );
}

// ── 일반 정산 내역 ────────────────────────────────────────────

function GeneralStatusChip({ status }: { status: string }) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        확인완료
      </span>
    );
  }
  if (status === "SUBMITTED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        대기중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
      임시저장
    </span>
  );
}

function GeneralSettlementRow({ item }: { item: GeneralSettlementItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground">
              {item.year}년 {item.month}월
            </span>
            {item.periodStart && item.periodEnd && (
              <span className="text-xs text-muted-foreground">
                {item.periodStart} ~ {item.periodEnd}
              </span>
            )}
          </div>
          <GeneralStatusChip status={item.status} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className="text-sm font-black text-foreground">
            {formatNumber(item.total)}원
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-xs min-w-[400px]">
              <thead>
                <tr>
                  <th className="border-b border-border bg-muted/50 px-2 py-1.5 text-center text-muted-foreground w-7">#</th>
                  {item.columns.map((col, ci) => (
                    <th key={ci} className="border-b border-border bg-muted/50 px-3 py-1.5 text-left font-bold text-muted-foreground">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.rows.map((row, ri) => (
                  <tr key={ri} className="even:bg-muted/10">
                    <td className="px-2 py-1.5 text-center text-muted-foreground">{ri + 1}</td>
                    {item.columns.map((_, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-foreground">
                        {row.cells[ci] || ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-semibold">합계</span>
              <span className="font-bold text-foreground">{formatNumber(item.subtotal)}원</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-semibold">부가세 (10%)</span>
              <span className="font-bold text-foreground">{formatNumber(item.tax)}원</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-1.5 mt-1.5">
              <span className="font-black text-foreground">총 정산 금액</span>
              <span className="font-black text-[oklch(0.52_0.27_264)]">{formatNumber(item.total)}원</span>
            </div>
          </div>
          {item.submittedAt && (
            <p className="text-xs text-muted-foreground">
              전송일: {new Date(item.submittedAt).toLocaleDateString("ko-KR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GeneralHistoryTab() {
  const [items, setItems] = useState<GeneralSettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/partner/general-settlements")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setItems(data.items);
        else setError("데이터를 불러오지 못했습니다.");
      })
      .catch(() => setError("데이터를 불러오는 중 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card shadow-card rounded-2xl p-6 animate-pulse space-y-4">
        {[1, 2, 3].map((j) => (
          <div key={j} className="h-14 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
        일반 정산 내역이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-card shadow-card rounded-2xl overflow-hidden max-w-2xl">
      {items.map((item) => (
        <GeneralSettlementRow key={item.id} item={item} />
      ))}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────

type HistoryTab = "points" | "general";

const HISTORY_TABS: { key: HistoryTab; label: string; icon: React.ElementType }[] = [
  { key: "points", label: "고객 포인트 정산", icon: Coins },
  { key: "general", label: "거래처 정산", icon: FileText },
];

export default function SettlementHistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryTab>("points");

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-black text-foreground tracking-tight">정산내역</h1>
        <p className="text-sm text-muted-foreground mt-1">정산 내역을 확인하세요.</p>
      </div>

      {/* 내부 탭 */}
      <div className="flex gap-2">
        {HISTORY_TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                active
                  ? "text-white shadow-sm"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
              }`}
              style={active ? { background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" } : undefined}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "points" ? <PointHistoryTab /> : <GeneralHistoryTab />}
    </div>
  );
}
