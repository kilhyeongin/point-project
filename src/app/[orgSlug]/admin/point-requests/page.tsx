"use client";

import { useEffect, useState, useMemo } from "react";
import { Coins, FileText, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Search, X } from "lucide-react";

type WithdrawalItem = {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  adminNote: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

type PointSettlementItem = {
  id: string;
  partnerId: string;
  partnerName: string;
  year: number;
  month: number;
  amount: number;
  note: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

function formatMoney(n: number) {
  return Number(n || 0).toLocaleString();
}

function StatusChip({ status }: { status: string }) {
  if (status === "CONFIRMED")
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" />확정</span>;
  if (status === "CANCELLED")
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border"><XCircle className="w-3 h-3" />취소</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" />대기중</span>;
}

type ActiveTab = "withdrawal" | "settlement";

export default function AdminPointRequestsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("withdrawal");
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [settlements, setSettlements] = useState<PointSettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const [wRes, sRes] = await Promise.all([
        fetch("/api/admin/withdrawal-requests"),
        fetch("/api/admin/point-settlements"),
      ]);
      const [wData, sData] = await Promise.all([wRes.json(), sRes.json()]);
      if (wData.ok) setWithdrawals(wData.items);
      if (sData.ok) setSettlements(sData.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function confirmWithdrawal(id: string) {
    setConfirming(id);
    try {
      const res = await fetch(`/api/admin/withdrawal-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.ok) setWithdrawals((prev) => prev.map((i) => i.id === id ? { ...i, status: "CONFIRMED", confirmedAt: new Date().toISOString() } : i));
      else alert(data.message || "오류가 발생했습니다.");
    } finally {
      setConfirming(null);
    }
  }

  async function confirmSettlement(id: string) {
    setConfirming(id);
    try {
      const res = await fetch(`/api/admin/point-settlements/${id}`, { method: "PATCH" });
      const data = await res.json();
      if (data.ok) setSettlements((prev) => prev.map((i) => i.id === id ? { ...i, status: "CONFIRMED", confirmedAt: new Date().toISOString() } : i));
      else alert(data.message || "오류가 발생했습니다.");
    } finally {
      setConfirming(null);
    }
  }

  function togglePartner(key: string) {
    setExpandedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // 업체별 그룹핑
  const wGroups = useMemo(() => {
    const map = new Map<string, { partnerId: string; partnerName: string; items: WithdrawalItem[]; pendingCount: number }>();
    withdrawals.forEach((i) => {
      const g = map.get(i.partnerId) ?? { partnerId: i.partnerId, partnerName: i.partnerName, items: [], pendingCount: 0 };
      g.items.push(i);
      if (i.status === "PENDING") g.pendingCount++;
      map.set(i.partnerId, g);
    });
    return Array.from(map.values()).sort((a, b) => b.pendingCount - a.pendingCount);
  }, [withdrawals]);

  const sGroups = useMemo(() => {
    const map = new Map<string, { partnerId: string; partnerName: string; items: PointSettlementItem[]; pendingCount: number }>();
    settlements.forEach((i) => {
      const g = map.get(i.partnerId) ?? { partnerId: i.partnerId, partnerName: i.partnerName, items: [], pendingCount: 0 };
      g.items.push(i);
      if (i.status === "PENDING") g.pendingCount++;
      map.set(i.partnerId, g);
    });
    return Array.from(map.values()).sort((a, b) => b.pendingCount - a.pendingCount);
  }, [settlements]);

  const filteredWGroups = useMemo(() => {
    if (!q.trim()) return wGroups;
    return wGroups.filter((g) => g.partnerName.toLowerCase().includes(q.toLowerCase()));
  }, [wGroups, q]);

  const filteredSGroups = useMemo(() => {
    if (!q.trim()) return sGroups;
    return sGroups.filter((g) => g.partnerName.toLowerCase().includes(q.toLowerCase()));
  }, [sGroups, q]);

  const totalWPending = withdrawals.filter((i) => i.status === "PENDING").length;
  const totalSPending = settlements.filter((i) => i.status === "PENDING").length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">포인트 출금/정산 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">제휴사의 포인트 출금 및 정산 요청을 처리합니다.</p>
        </div>
        <div className="flex gap-2">
          {totalWPending > 0 && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3.5 h-3.5" />출금 대기 {totalWPending}건
            </span>
          )}
          {totalSPending > 0 && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Clock className="w-3.5 h-3.5" />정산 대기 {totalSPending}건
            </span>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {([["withdrawal", "포인트 출금", Coins], ["settlement", "포인트 정산", FileText]] as const).map(([key, label, Icon]) => {
          const active = activeTab === key;
          return (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${active ? "text-white shadow-sm" : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border"}`}
              style={active ? { background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" } : undefined}>
              <Icon className="w-4 h-4" />{label}
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="업체명 검색"
          className="w-full pl-9 pr-9 h-10 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        {q && <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
      </div>

      {loading ? (
        <div className="bg-card shadow-card rounded-2xl p-6 animate-pulse space-y-3">
          {[1, 2, 3].map((j) => <div key={j} className="h-14 bg-muted rounded-xl" />)}
        </div>
      ) : activeTab === "withdrawal" ? (
        /* ── 출금 요청 목록 ── */
        filteredWGroups.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">출금 요청이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {filteredWGroups.map((group) => {
              const key = `w-${group.partnerId}`;
              const isOpen = expandedPartners.has(key);
              return (
                <div key={group.partnerId} className="bg-card shadow-card rounded-2xl overflow-hidden">
                  <button type="button" onClick={() => togglePartner(key)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                        style={{ background: "oklch(0.52 0.27 264)" }}>
                        {(group.partnerName || "?").charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-foreground">{group.partnerName || "—"}</div>
                        <div className="text-xs text-muted-foreground">요청 {group.items.length}건</div>
                      </div>
                      {group.pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />대기 {group.pendingCount}
                        </span>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-border divide-y divide-border">
                      {group.items.map((item) => (
                        <div key={item.id} className="px-5 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-black text-foreground">{formatMoney(item.amount)}P</div>
                              <div className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("ko-KR")} 신청</div>
                            </div>
                            <StatusChip status={item.status} />
                          </div>
                          {item.status === "PENDING" && (
                            <button type="button" onClick={() => confirmWithdrawal(item.id)} disabled={confirming === item.id}
                              className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
                              style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}>
                              {confirming === item.id ? "처리 중..." : "출금 확정"}
                            </button>
                          )}
                          {item.confirmedAt && <p className="text-xs text-muted-foreground">확정일: {new Date(item.confirmedAt).toLocaleDateString("ko-KR")}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── 포인트 정산 목록 ── */
        filteredSGroups.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">포인트 정산 요청이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {filteredSGroups.map((group) => {
              const key = `s-${group.partnerId}`;
              const isOpen = expandedPartners.has(key);
              return (
                <div key={group.partnerId} className="bg-card shadow-card rounded-2xl overflow-hidden">
                  <button type="button" onClick={() => togglePartner(key)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                        style={{ background: "oklch(0.44 0.24 280)" }}>
                        {(group.partnerName || "?").charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-foreground">{group.partnerName || "—"}</div>
                        <div className="text-xs text-muted-foreground">요청 {group.items.length}건</div>
                      </div>
                      {group.pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3" />대기 {group.pendingCount}
                        </span>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-border divide-y divide-border">
                      {group.items.map((item) => (
                        <div key={item.id} className="px-5 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-black text-foreground">{item.year}년 {item.month}월 — {formatMoney(item.amount)}P</div>
                              {item.note && <div className="text-xs text-muted-foreground mt-0.5">{item.note}</div>}
                              <div className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("ko-KR")} 신청</div>
                            </div>
                            <StatusChip status={item.status} />
                          </div>
                          {item.status === "PENDING" && (
                            <button type="button" onClick={() => confirmSettlement(item.id)} disabled={confirming === item.id}
                              className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
                              style={{ background: "linear-gradient(135deg, oklch(0.44 0.24 280) 0%, oklch(0.52 0.27 264) 100%)" }}>
                              {confirming === item.id ? "처리 중..." : "정산 확정"}
                            </button>
                          )}
                          {item.confirmedAt && <p className="text-xs text-muted-foreground">확정일: {new Date(item.confirmedAt).toLocaleDateString("ko-KR")}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
