"use client";

import { useEffect, useState, useMemo } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Clock, Search, X, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";

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

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function AdminGeneralSettlementsPage() {
  const currentYear = new Date().getFullYear();
  const [items, setItems] = useState<GeneralSettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);

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

  // 선택 연도 + 월 범위 기준 필터
  const yearItems = useMemo(
    () => items.filter((i) => i.year === selectedYear && i.month >= startMonth && i.month <= endMonth),
    [items, selectedYear, startMonth, endMonth]
  );

  // 통계 (선택 연도)
  const stats = useMemo(() => {
    const confirmed = yearItems.filter((i) => i.status === "CONFIRMED");
    const pending = yearItems.filter((i) => i.status === "SUBMITTED");
    return {
      confirmedTotal: confirmed.reduce((s, i) => s + i.total, 0),
      confirmedCount: confirmed.length,
      pendingTotal: pending.reduce((s, i) => s + i.total, 0),
      pendingCount: pending.length,
      allCount: yearItems.filter((i) => i.status !== "DRAFT").length,
    };
  }, [yearItems]);

  // 월별 통계 (선택 연도 + 월 범위)
  const monthlyStats = useMemo(() => {
    return MONTHS.filter((m) => m >= startMonth && m <= endMonth).map((m) => {
      const mItems = yearItems.filter((i) => i.month === m && i.status !== "DRAFT");
      const confirmed = mItems.filter((i) => i.status === "CONFIRMED");
      return {
        month: m,
        count: mItems.length,
        total: mItems.reduce((s, i) => s + i.total, 0),
        confirmedTotal: confirmed.reduce((s, i) => s + i.total, 0),
        confirmedCount: confirmed.length,
      };
    });
  }, [yearItems, startMonth, endMonth]);

  // 업체별 그룹핑 (선택 연도 기준)
  const groups = useMemo<PartnerGroup[]>(() => {
    const map = new Map<string, PartnerGroup>();
    yearItems.forEach((item) => {
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
  }, [yearItems]);

  const filtered = useMemo(() => {
    if (!q.trim()) return groups;
    const lower = q.toLowerCase();
    return groups.filter((g) => g.partnerName.toLowerCase().includes(lower));
  }, [groups, q]);

  // 전체 대기중 (연도 무관)
  const totalPending = items.filter((i) => i.status === "SUBMITTED").length;

  // 연도 범위 (현재 기준 -3 ~ +1)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  const hasMonthlyData = monthlyStats.some((m) => m.count > 0);

  return (
    <div className="space-y-5 max-w-3xl">
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

      {/* 연도 선택 */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-bold text-muted-foreground">기간</span>
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={() => setSelectedYear((y) => Math.max(y - 1, yearOptions[0]))}
            disabled={selectedYear <= yearOptions[0]}
            className="p-1 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex gap-1">
            {yearOptions.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                  selectedYear === y
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                style={selectedYear === y ? { background: "oklch(0.52 0.27 264)" } : undefined}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSelectedYear((y) => Math.min(y + 1, yearOptions[yearOptions.length - 1]))}
            disabled={selectedYear >= yearOptions[yearOptions.length - 1]}
            className="p-1 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* 월 범위 선택 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-muted-foreground shrink-0">기간</span>
        <div className="flex items-center gap-1.5">
          <select
            value={startMonth}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStartMonth(v);
              if (v > endMonth) setEndMonth(v);
            }}
            className="h-8 px-2 rounded-lg border border-border bg-card text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground font-semibold">~</span>
          <select
            value={endMonth}
            onChange={(e) => {
              const v = Number(e.target.value);
              setEndMonth(v);
              if (v < startMonth) setStartMonth(v);
            }}
            className="h-8 px-2 rounded-lg border border-border bg-card text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          {(startMonth !== 1 || endMonth !== 12) && (
            <button
              type="button"
              onClick={() => { setStartMonth(1); setEndMonth(12); }}
              className="h-8 px-2.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 통계 카드 */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card shadow-card rounded-2xl px-4 py-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">확인완료 총액</p>
            <p className="text-lg font-black text-foreground leading-tight">
              {formatMoney(stats.confirmedTotal)}
              <span className="text-xs font-bold text-muted-foreground ml-1">원</span>
            </p>
            <p className="text-xs text-muted-foreground">{stats.confirmedCount}건</p>
          </div>
          <div className="bg-card shadow-card rounded-2xl px-4 py-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">대기중 총액</p>
            <p className="text-lg font-black leading-tight" style={{ color: "oklch(0.72 0.18 80)" }}>
              {formatMoney(stats.pendingTotal)}
              <span className="text-xs font-bold text-muted-foreground ml-1">원</span>
            </p>
            <p className="text-xs text-muted-foreground">{stats.pendingCount}건</p>
          </div>
          <div className="bg-card shadow-card rounded-2xl px-4 py-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">전체 건수</p>
            <p className="text-lg font-black text-foreground leading-tight">
              {stats.allCount}
              <span className="text-xs font-bold text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedYear}년 {startMonth === 1 && endMonth === 12 ? "전체" : `${startMonth}월~${endMonth}월`}
            </p>
          </div>
        </div>
      )}

      {/* 월별 통계 테이블 */}
      {!loading && hasMonthlyData && (
        <div className="bg-card shadow-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <span className="text-sm font-black text-foreground">
              {selectedYear}년 {startMonth === 1 && endMonth === 12 ? "월별 현황" : `${startMonth}월~${endMonth}월 현황`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-4 py-2.5 text-left font-bold text-muted-foreground">월</th>
                  <th className="px-4 py-2.5 text-right font-bold text-muted-foreground">건수</th>
                  <th className="px-4 py-2.5 text-right font-bold text-muted-foreground">총액</th>
                  <th className="px-4 py-2.5 text-right font-bold text-muted-foreground">확인완료액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthlyStats.map((m) => (
                  <tr
                    key={m.month}
                    className={`transition-colors ${m.count > 0 ? "hover:bg-muted/20" : "opacity-40"}`}
                  >
                    <td className="px-4 py-2.5 font-semibold text-foreground">{m.month}월</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {m.count > 0 ? `${m.count}건` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-foreground">
                      {m.total > 0 ? `${formatMoney(m.total)}원` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold" style={m.confirmedTotal > 0 ? { color: "oklch(0.52 0.18 160)" } : undefined}>
                      {m.confirmedTotal > 0 ? `${formatMoney(m.confirmedTotal)}원` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 border-t-2 border-border">
                  <td className="px-4 py-2.5 font-black text-foreground">합계</td>
                  <td className="px-4 py-2.5 text-right font-black text-foreground">{stats.allCount}건</td>
                  <td className="px-4 py-2.5 text-right font-black text-foreground">
                    {monthlyStats.reduce((s, m) => s + m.total, 0) > 0
                      ? `${formatMoney(monthlyStats.reduce((s, m) => s + m.total, 0))}원`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black" style={{ color: "oklch(0.52 0.18 160)" }}>
                    {stats.confirmedTotal > 0 ? `${formatMoney(stats.confirmedTotal)}원` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

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
          {q
            ? "검색 결과가 없습니다."
            : `${selectedYear}년 ${startMonth === 1 && endMonth === 12 ? "" : `${startMonth}월~${endMonth}월 `}제출된 정산서가 없습니다.`}

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
