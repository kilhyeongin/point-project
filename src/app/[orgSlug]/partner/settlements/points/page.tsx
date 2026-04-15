"use client";

import { useEffect, useState } from "react";

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

function StatusChip({ status }: { status: string }) {
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

export default function PartnerPointsSettlementsPage() {
  const [item, setItem] = useState<SettlementItem | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentPeriodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  useEffect(() => {
    fetch("/api/partner/settlements")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          const found = data.items.find(
            (it: SettlementItem) => it.periodKey === currentPeriodKey
          );
          setItem(found ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [currentPeriodKey]);

  return (
    <div className="space-y-4 max-w-2xl">
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
      ) : (
        <div className="bg-card shadow-card rounded-2xl overflow-hidden">
          {/* 이번 달 헤더 */}
          <div className="flex flex-col items-center border-b border-border pt-4 pb-3 gap-2">
            {item && <StatusChip status={item.status} />}
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm text-muted-foreground font-semibold">{currentYear}년</span>
              <span className="text-2xl font-black text-foreground">{currentMonth}월</span>
            </div>
          </div>

          {item ? (
            <>
              {/* 정산 지급액 */}
              <div className="px-5 py-6 text-center border-b border-border">
                <p className="text-xs text-muted-foreground font-semibold mb-1">정산 지급액</p>
                <p className="text-4xl font-black text-foreground tracking-tight">
                  {formatNumber(item.netPayable)}
                  <span className="text-2xl ml-1 text-muted-foreground font-bold">P</span>
                </p>
                {item.paidAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    지급일 {new Date(item.paidAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* 지표 목록 */}
              <div className="px-5 py-1">
                <StatRow label="방문 고객" value={`${formatNumber(item.visitorCount)}명`} />
                <StatRow label="포인트 지급" value={`${formatNumber(item.issuedPoints)}P`} />
                <StatRow label="포인트 사용" value={`${formatNumber(item.usedPoints)}P`} />
                <StatRow label="계약 완료" value={`${formatNumber(item.completedCount)}건`} />
                <StatRow label="방문 취소" value={`${formatNumber(item.cancelledCount)}건`} />
                <StatRow label="지급 횟수" value={`${formatNumber(item.issueCount)}회`} />
                <StatRow label="사용 횟수" value={`${formatNumber(item.useCount)}회`} />
                {item.note && <StatRow label="메모" value={item.note} />}
              </div>
            </>
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-muted-foreground">이번 달 정산 내역이 없습니다.</p>
              <p className="text-xs text-muted-foreground mt-1">정산내역 탭에서 이전 달을 확인할 수 있습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
