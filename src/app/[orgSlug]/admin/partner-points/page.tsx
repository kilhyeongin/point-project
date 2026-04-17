"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Search, Loader2, RefreshCw, Plus, Minus } from "lucide-react";
import { formatUsername } from "@/lib/utils";

type User = { id: string; username: string; name: string; balance: number };
type LedgerItem = {
  id: string; type: string; amount: number; note: string; createdAt: string;
  account: { name: string; username: string } | null;
  actor: { name: string } | null;
};

const TYPE_LABEL: Record<string, string> = { TOPUP: "충전", ADJUST: "조정", ISSUE: "지급", USE: "사용" };
const TYPE_COLOR: Record<string, string> = {
  TOPUP: "bg-emerald-100 text-emerald-700",
  ADJUST: "bg-violet-100 text-violet-700",
  ISSUE: "bg-blue-100 text-blue-700",
  USE: "bg-zinc-100 text-zinc-600",
};

function fmt(n: number) { return Number(n || 0).toLocaleString(); }
function fmtDate(v: string) {
  if (!v) return "-";
  const d = new Date(v);
  return `${d.getFullYear().toString().slice(2)}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function PartnerPointsPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  // ── 폼 상태 ──
  const [mode, setMode] = useState<"charge" | "deduct">("charge");
  const [userQ, setUserQ] = useState("");
  const [userResults, setUserResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  // ── 내역 상태 ──
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [filterQ, setFilterQ] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // 사용자 검색
  useEffect(() => {
    if (!userQ.trim()) { setUserResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/accounts?role=PARTNER&q=${encodeURIComponent(userQ)}&limit=10`);
        const data = await res.json();
        setUserResults(data.items ?? []);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [userQ]);

  // 내역 로드
  const loadLedger = useCallback(async (p = 1) => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({ role: "PARTNER", page: String(p) });
      if (filterQ) params.set("q", filterQ);
      if (filterType !== "ALL") params.set("type", filterType);
      if (filterStart) params.set("start", filterStart);
      if (filterEnd) params.set("end", filterEnd);
      const res = await fetch(`/api/admin/ledger?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
      setPage(p);
    } finally { setLedgerLoading(false); }
  }, [filterQ, filterType, filterStart, filterEnd]);

  useEffect(() => { loadLedger(1); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) { toast.error("제휴사를 선택해주세요."); return; }
    const amtNum = Number(amount.replace(/,/g, ""));
    if (!amtNum || amtNum <= 0) { toast.error("금액을 올바르게 입력해주세요."); return; }
    if (mode === "deduct" && !note.trim()) { toast.error("차감 사유를 입력해주세요."); return; }

    setSubmitting(true);
    try {
      if (mode === "charge") {
        const res = await fetch("/api/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: selectedUser.id, amount: amtNum, note }),
        });
        const data = await res.json();
        if (!data.ok) { toast.error(data.message ?? "충전 실패"); return; }
        toast.success(`${selectedUser.name}에게 ${fmt(amtNum)}P 충전 완료`);
      } else {
        const res = await fetch("/api/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: selectedUser.id, amount: -amtNum, note }),
        });
        const data = await res.json();
        if (!data.ok) { toast.error(data.message ?? "차감 실패"); return; }
        toast.success(`${selectedUser.name}에서 ${fmt(amtNum)}P 차감 완료`);
      }
      setAmount(""); setNote(""); setSelectedUser(null); setUserQ("");
      loadLedger(1);
    } finally { setSubmitting(false); }
  }

  return (
    <main className="max-w-3xl space-y-5">
      {/* 헤더 */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">포인트 관리</p>
        <h1 className="text-2xl font-black text-foreground tracking-tight">제휴사 포인트 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">제휴사 포인트를 충전하거나 차감합니다.</p>
      </div>

      {/* 충전/차감 폼 */}
      <div className="bg-card border border-border rounded-2xl p-6">
        {/* 모드 탭 */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-5 w-fit">
          <button
            type="button"
            onClick={() => setMode("charge")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === "charge" ? "bg-white text-emerald-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Plus className="w-3.5 h-3.5" /> 충전
          </button>
          <button
            type="button"
            onClick={() => setMode("deduct")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === "deduct" ? "bg-white text-red-500 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Minus className="w-3.5 h-3.5" /> 차감
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 제휴사 검색 */}
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">제휴사 선택</label>
            {selectedUser ? (
              <div className="flex items-center justify-between px-4 py-3 border border-border rounded-xl bg-muted/30">
                <div>
                  <span className="font-bold text-foreground">{selectedUser.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{formatUsername(selectedUser.username)}</span>
                  <span className="ml-2 text-xs font-bold text-primary">잔액 {fmt(selectedUser.balance)}P</span>
                </div>
                <button type="button" onClick={() => { setSelectedUser(null); setUserQ(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">변경</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={userQ}
                  onChange={(e) => setUserQ(e.target.value)}
                  placeholder="이름 또는 아이디 검색"
                  className="w-full h-10 pl-9 pr-4 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                {userResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                    {userResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedUser(u); setUserQ(""); setUserResults([]); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted text-left transition-colors"
                      >
                        <span className="text-sm font-bold text-foreground">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{formatUsername(u.username)} · {fmt(u.balance)}P</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 금액 */}
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">
              {mode === "charge" ? "충전" : "차감"} 금액 (P)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 10000"
              min={1}
              className="w-full h-10 px-4 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">
              사유 {mode === "deduct" && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "deduct" ? "차감 사유 필수 입력" : "선택 입력"}
              className="w-full h-10 px-4 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedUser}
            className={`w-full h-11 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-40 ${mode === "charge" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}
          >
            {submitting ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />처리 중</span> : mode === "charge" ? "충전하기" : "차감하기"}
          </button>
        </form>
      </div>

      {/* 내역 필터 */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground">제휴사 전체 내역</h2>
          <span className="text-xs text-muted-foreground">총 {fmt(total)}건</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLedger(1)}
              placeholder="이름/아이디"
              className="w-full h-9 pl-8 pr-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-9 px-2 border border-border rounded-lg text-sm bg-background focus:outline-none">
            <option value="ALL">전체 유형</option>
            <option value="TOPUP">충전</option>
            <option value="ADJUST">조정</option>
            <option value="ISSUE">지급</option>
            <option value="USE">사용</option>
          </select>
          <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="h-9 px-2 border border-border rounded-lg text-sm bg-background focus:outline-none" />
          <span className="flex items-center text-xs text-muted-foreground">~</span>
          <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="h-9 px-2 border border-border rounded-lg text-sm bg-background focus:outline-none" />
          <button onClick={() => loadLedger(1)} className="h-9 px-4 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />조회
          </button>
        </div>

        {ledgerLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />불러오는 중
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">내역이 없습니다.</div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {items.map((it) => (
                <div key={it.id} className="flex items-center py-3 gap-3">
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_COLOR[it.type] ?? "bg-zinc-100 text-zinc-600"}`}>
                    {TYPE_LABEL[it.type] ?? it.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{it.account?.name ?? "-"}</p>
                    <p className="text-xs text-muted-foreground truncate">{it.note || "-"} · {fmtDate(it.createdAt)}</p>
                  </div>
                  <span className={`text-sm font-black shrink-0 ${it.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {it.amount >= 0 ? "+" : ""}{fmt(it.amount)}P
                  </span>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={() => loadLedger(page - 1)} disabled={page === 1} className="h-8 px-3 rounded-lg border border-border text-sm font-bold disabled:opacity-30 hover:bg-muted transition-colors">이전</button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button onClick={() => loadLedger(page + 1)} disabled={page === totalPages} className="h-8 px-3 rounded-lg border border-border text-sm font-bold disabled:opacity-30 hover:bg-muted transition-colors">다음</button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
