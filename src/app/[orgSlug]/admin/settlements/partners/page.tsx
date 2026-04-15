"use client";

import { useEffect, useState, useMemo } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Clock, Search, X } from "lucide-react";

type GeneralSettlementItem = {
  id: string;
  partnerId: string;
  partnerName: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  columns: string[];
  rows: Array<{ cells: string[] }>;
  subtotal: number;
  tax: number;
  total: number;
  status: "DRAFT" | "SUBMITTED" | "CONFIRMED";
  submittedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
};

function formatMoney(n: number) {
  return Number(n || 0).toLocaleString();
}

function StatusChip({ status }: { status: string }) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        확인완료
      </span>
    );
  }
  if (status === "SUBMITTED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" />
        대기중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
      임시저장
    </span>
  );
}

function SettlementRow({
  item,
  onConfirm,
  confirming,
}: {
  item: GeneralSettlementItem;
  onConfirm: (id: string) => void;
  confirming: string | null;
}) {
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
          {/* 테이블 */}
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

          {/* 합계 */}
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
              <span className="font-black" style={{ color: "oklch(0.52 0.27 264)" }}>{formatMoney(item.total)}원</span>
            </div>
          </div>

          {/* 날짜 정보 */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {item.submittedAt && (
              <span>전송일: {new Date(item.submittedAt).toLocaleDateString("ko-KR")}</span>
            )}
            {item.confirmedAt && (
              <span>확인일: {new Date(item.confirmedAt).toLocaleDateString("ko-KR")}</span>
            )}
          </div>

          {/* 확인 버튼 */}
          {item.status === "SUBMITTED" && (
            <button
              type="button"
              onClick={() => onConfirm(item.id)}
              disabled={confirming === item.id}
              className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}
            >
              {confirming === item.id ? "처리 중..." : "확인완료 처리"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 업체별 그룹
type PartnerGroup = {
  partnerId: string;
  partnerName: string;
  items: GeneralSettlementItem[];
  pendingCount: number;
};

export default function AdminGeneralSettlementsPage() {
  const [items, setItems] = useState<GeneralSettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/general-settlements");
      const data = await res.json();
      if (data.ok) setItems(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleConfirm(id: string) {
    setConfirming(id);
    try {
      const res = await fetch(`/api/admin/general-settlements/${id}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: "CONFIRMED", confirmedAt: new Date().toISOString() }
              : item
          )
        );
      }
    } finally {
      setConfirming(null);
    }
  }

  function togglePartner(partnerId: string) {
    setExpandedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  }

  // 업체별 그룹핑
  const groups = useMemo<PartnerGroup[]>(() => {
    const map = new Map<string, PartnerGroup>();
    items.forEach((item) => {
      const existing = map.get(item.partnerId);
      if (existing) {
        existing.items.push(item);
        if (item.status === "SUBMITTED") existing.pendingCount++;
      } else {
        map.set(item.partnerId, {
          partnerId: item.partnerId,
          partnerName: item.partnerName,
          items: [item],
          pendingCount: item.status === "SUBMITTED" ? 1 : 0,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.pendingCount - a.pendingCount);
  }, [items]);

  const filtered = useMemo(() => {
    if (!q.trim()) return groups;
    const lower = q.toLowerCase();
    return groups.filter((g) => g.partnerName.toLowerCase().includes(lower));
  }, [groups, q]);

  const totalPending = items.filter((i) => i.status === "SUBMITTED").length;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">일반 정산 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">제휴사가 제출한 정산서를 확인하고 처리합니다.</p>
        </div>
        {totalPending > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            대기중 {totalPending}건
          </div>
        )}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="업체명 검색"
          className="w-full pl-9 pr-9 h-10 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-card shadow-card rounded-2xl p-6 animate-pulse space-y-3">
          {[1, 2, 3].map((j) => <div key={j} className="h-14 bg-muted rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          {q ? "검색 결과가 없습니다." : "제출된 정산서가 없습니다."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((group) => {
            const isOpen = expandedPartners.has(group.partnerId);
            return (
              <div key={group.partnerId} className="bg-card shadow-card rounded-2xl overflow-hidden">
                {/* 업체 헤더 */}
                <button
                  type="button"
                  onClick={() => togglePartner(group.partnerId)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                      style={{ background: "oklch(0.52 0.27 264)" }}
                    >
                      {(group.partnerName || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-foreground truncate">{group.partnerName || "—"}</div>
                      <div className="text-xs text-muted-foreground">정산서 {group.items.length}건</div>
                    </div>
                    {group.pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" />
                        대기 {group.pendingCount}
                      </span>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* 정산서 목록 */}
                {isOpen && (
                  <div className="border-t border-border">
                    {group.items.map((item) => (
                      <SettlementRow
                        key={item.id}
                        item={item}
                        onConfirm={handleConfirm}
                        confirming={confirming}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
