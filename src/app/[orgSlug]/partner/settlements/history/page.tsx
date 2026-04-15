"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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

function formatMoney(n: number) {
  return Number(n || 0).toLocaleString();
}

function StatusChip({ status }: { status: string }) {
  if (status === "SUBMITTED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[oklch(0.52_0.27_264)]/15 text-[oklch(0.52_0.27_264)]">
        전송완료
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
      임시저장
    </span>
  );
}

function SettlementRow({ item }: { item: GeneralSettlementItem }) {
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
          <StatusChip status={item.status} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className="text-sm font-black text-foreground">
            {formatMoney(item.total)}원
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
          {/* Table preview */}
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

          {/* Summary */}
          <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-semibold">합계</span>
              <span className="font-bold text-foreground">{formatMoney(item.subtotal)}원</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-semibold">부가세 (10%)</span>
              <span className="font-bold text-foreground">{formatMoney(item.tax)}원</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-1.5 mt-1.5">
              <span className="font-black text-foreground">총 정산 금액</span>
              <span className="font-black text-[oklch(0.52_0.27_264)]">{formatMoney(item.total)}원</span>
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

export default function SettlementHistoryPage() {
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-foreground tracking-tight">정산내역</h1>
        <p className="text-sm text-muted-foreground mt-1">제출한 일반 정산 내역을 확인하세요.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-card shadow-card rounded-2xl p-6 animate-pulse space-y-4">
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-14 bg-muted rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          정산 내역이 없습니다.
        </div>
      ) : (
        <div className="bg-card shadow-card rounded-2xl overflow-hidden">
          {items.map((item) => (
            <SettlementRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
