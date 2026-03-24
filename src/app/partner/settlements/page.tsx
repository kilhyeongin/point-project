"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type SettlementItem = {
  id: string;
  periodKey: string;
  usedPoints: number;
  netPayable: number;
  status: string;
  paidAt?: string | null;
};

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function statusLabel(s: string) {
  if (s === "PAID") return "지급완료";
  if (s === "CLOSED") return "마감";
  if (s === "OPEN") return "정산대기";
  return s;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PAID")
    return <Badge className="bg-foreground text-background hover:bg-foreground/90">{statusLabel(status)}</Badge>;
  if (status === "CLOSED")
    return <Badge variant="secondary">{statusLabel(status)}</Badge>;
  return <Badge variant="outline">{statusLabel(status)}</Badge>;
}

export default function PartnerSettlementsPage() {
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/partner/settlements");
    const data = await res.json();
    if (data.ok) setItems(data.items);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-foreground tracking-tight">내 정산 내역</h1>
        <p className="text-sm text-muted-foreground mt-1">
          제휴사 포인트 사용에 대한 정산 내역입니다.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card shadow-card rounded-2xl p-4">
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          정산 내역이 없습니다.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card shadow-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: 560 }}>
                <div
                  className="grid gap-2 px-4 py-3 bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground"
                  style={{ gridTemplateColumns: "100px 1fr 1fr 90px 60px" }}
                >
                  <div>기간</div>
                  <div className="text-right">사용포인트</div>
                  <div className="text-right">지급액</div>
                  <div>상태</div>
                  <div>PDF</div>
                </div>

                {items.map((it) => (
                  <div
                    key={it.id}
                    className="grid gap-2 px-4 py-3 border-b border-border/60 last:border-0 text-sm items-center"
                    style={{ gridTemplateColumns: "100px 1fr 1fr 90px 60px" }}
                  >
                    <div className="font-bold">{it.periodKey}</div>
                    <div className="text-right font-black">{formatNumber(it.usedPoints)}P</div>
                    <div className="text-right font-black text-primary">{formatNumber(it.netPayable)}P</div>
                    <div><StatusBadge status={it.status} /></div>
                    <div>
                      <a
                        href={`/api/admin/settlements/pdf?periodKey=${it.periodKey}`}
                        target="_blank"
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {items.map((it) => (
              <div key={it.id} className="bg-card shadow-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="text-lg font-black">{it.periodKey}</div>
                  <div className="text-lg font-black text-primary">{formatNumber(it.netPayable)}P</div>
                </div>

                <div className="space-y-2 text-sm">
                  {[
                    { label: "사용포인트", value: `${formatNumber(it.usedPoints)}P` },
                    { label: "지급액", value: `${formatNumber(it.netPayable)}P` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">상태</span>
                    <StatusBadge status={it.status} />
                  </div>
                </div>

                <div className="mt-3">
                  <a
                    href={`/api/admin/settlements/pdf?periodKey=${it.periodKey}`}
                    target="_blank"
                    className="flex items-center justify-center h-11 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-accent transition-colors"
                  >
                    정산서 PDF 보기
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
