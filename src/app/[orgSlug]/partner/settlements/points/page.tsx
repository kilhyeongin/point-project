"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SettlementItem = {
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

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function statusLabel(s: string) {
  if (s === "PAID") return "마감";
  if (s === "OPEN") return "마감";
  if (s === "PENDING") return "집계중";
  return s;
}

function StatusChip({ status }: { status: string }) {
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold";
  if (status === "PAID")
    return <span className={`${base} bg-foreground text-background`}>{statusLabel(status)}</span>;
  if (status === "PENDING")
    return <span className={`${base} bg-muted text-muted-foreground border border-border`}>{statusLabel(status)}</span>;
  return <span className={`${base} bg-muted text-muted-foreground border border-border`}>{statusLabel(status)}</span>;
}

function formatPeriod(periodKey: string) {
  const [year, month] = periodKey.split("-");
  return { year, month: String(Number(month)) };
}

type StatRowProps = { label: string; value: string; highlight?: boolean };
function StatRow({ label, value, highlight }: StatRowProps) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${highlight ? "text-foreground text-base" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

export default function PartnerPointsSettlementsPage() {
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch("/api/partner/settlements")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setItems(data.items);
      })
      .finally(() => setLoading(false));
  }, []);

  const it = items[currentIndex] ?? null;
  const total = items.length;

  function prev() {
    setCurrentIndex((i) => Math.min(i + 1, total - 1));
  }
  function next() {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-foreground tracking-tight">포인트 정산</h1>
        <p className="text-sm text-muted-foreground mt-1">매월 말일 기준으로 정산됩니다.</p>
      </div>

      {loading ? (
        <div className="bg-card shadow-card rounded-2xl p-6 animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-28 mx-auto" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-10 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      ) : total === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          정산 내역이 없습니다.
        </div>
      ) : (
        <div className="bg-card shadow-card rounded-2xl overflow-hidden">
          {/* 월 네비게이터 */}
          <div className="flex flex-col border-b border-border">
            {/* 상태 */}
            {it && (
              <div className="flex justify-center pt-4">
                <StatusChip status={it.status} />
              </div>
            )}
            {/* 월 이동 */}
            <div className="flex items-center justify-between px-5 py-3">
              <button
                type="button"
                onClick={prev}
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
                onClick={next}
                disabled={currentIndex <= 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground disabled:opacity-25 hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 정산 지급액 강조 */}
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

              {/* 지표 목록 */}
              <div className="px-5 py-1">
                <StatRow label="방문 고객" value={`${formatNumber(it.visitorCount)}명`} />
                <StatRow label="포인트 지급" value={`${formatNumber(it.issuedPoints)}P`} />
                <StatRow label="포인트 사용" value={`${formatNumber(it.usedPoints)}P`} />
                <StatRow label="계약 완료" value={`${formatNumber(it.completedCount)}건`} />
                <StatRow label="방문 취소" value={`${formatNumber(it.cancelledCount)}건`} />
                <StatRow label="지급 횟수" value={`${formatNumber(it.issueCount)}회`} />
                <StatRow label="사용 횟수" value={`${formatNumber(it.useCount)}회`} />
                {it.note && (
                  <StatRow label="메모" value={it.note} />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
