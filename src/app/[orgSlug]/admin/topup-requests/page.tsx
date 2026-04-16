"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatUsername } from "@/lib/utils";

type Item = {
  id: string;
  amount: number;
  status: string;
  note?: string;
  createdAt: string;
  decidedAt?: string | null;
  account: { id: string; username: string; name: string; role: string } | null;
  requestedBy?: { username: string; name: string; role: string } | null;
  approvedBy?: { username: string; name: string; role: string } | null;
};

type Tab = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

function fmt(n: number) {
  return Number(n || 0).toLocaleString();
}

function fmtDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

function StatusChip({ status }: { status: string }) {
  if (status === "APPROVED")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        승인완료
      </span>
    );
  if (status === "PENDING")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" />
        대기 중
      </span>
    );
  if (status === "REJECTED")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3" />
        거절
      </span>
    );
  return <span className="text-xs text-muted-foreground">{status}</span>;
}

export default function TopupRequestsPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("PENDING");

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((i) => i.status === "PENDING").length,
    approved: items.filter((i) => i.status === "APPROVED").length,
    rejected: items.filter((i) => i.status === "REJECTED").length,
  }), [items]);

  const filtered = useMemo(() => {
    const list = tab === "ALL" ? items : items.filter((i) => i.status === tab);
    return [...list].sort((a, b) => {
      // PENDING 항목을 항상 위로
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (b.status === "PENDING" && a.status !== "PENDING") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, tab]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/topup-requests");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "목록 조회 실패");
        return;
      }
      setItems(data.items || []);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setWorkingId(id);
    try {
      const res = await fetch(`/api/admin/topup-requests/${id}/approve`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data?.message ?? "승인 실패");
        return;
      }
      toast.success("충전 요청을 승인했습니다.");
      await load(true);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setWorkingId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "PENDING", label: "대기 중", count: counts.pending },
    { key: "ALL", label: "전체", count: counts.all },
    { key: "APPROVED", label: "승인완료", count: counts.approved },
    { key: "REJECTED", label: "거절", count: counts.rejected },
  ];

  return (
    <main className="space-y-5 max-w-3xl mx-auto">
      {/* ── 헤더 ── */}
      <section className="bg-card shadow-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-1">
              포인트 관리
            </p>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              충전 요청 승인
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              제휴사의 충전 요청을 승인하면 해당 계정 잔액에 즉시 반영됩니다.
            </p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border bg-card text-sm font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </button>
        </div>

        {/* 요약 수치 */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
            <div className="text-xl font-black text-foreground">{counts.all}</div>
            <div className="text-xs text-muted-foreground mt-0.5 font-semibold">전체</div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
            <div className="text-xl font-black text-amber-700">{counts.pending}</div>
            <div className="text-xs text-amber-600 mt-0.5 font-semibold">대기 중</div>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-center">
            <div className="text-xl font-black text-emerald-700">{counts.approved}</div>
            <div className="text-xs text-emerald-600 mt-0.5 font-semibold">승인완료</div>
          </div>
        </div>
      </section>

      {/* ── 탭 필터 ── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-9 px-4 rounded-xl text-sm font-bold transition-colors ${
              tab === t.key
                ? "bg-foreground text-background"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${tab === t.key ? "opacity-70" : "opacity-50"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── 목록 ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm font-semibold">불러오는 중...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground bg-card shadow-card rounded-2xl">
          {tab === "PENDING" ? "대기 중인 충전 요청이 없습니다." : "해당 조건의 요청이 없습니다."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => (
            <article
              key={it.id}
              className={`bg-card shadow-card rounded-2xl overflow-hidden ${
                it.status === "PENDING" ? "ring-1 ring-amber-300" : ""
              }`}
            >
              {/* 카드 상단 강조 바 (PENDING만) */}
              {it.status === "PENDING" && (
                <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
              )}

              <div className="p-5">
                {/* 1행: 제휴사 정보 + 금액 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-foreground">
                        {it.account?.name ?? "-"}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {it.account ? formatUsername(it.account.username) : "-"}
                      </span>
                      <StatusChip status={it.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      요청일 {fmtDate(it.createdAt)}
                      {it.requestedBy && (
                        <> · 요청자 {it.requestedBy.name}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-foreground tracking-tight">
                      {fmt(it.amount)}
                      <span className="text-base font-bold ml-0.5">P</span>
                    </div>
                  </div>
                </div>

                {/* 2행: 메모 (있을 때만) */}
                {it.note && (
                  <div className="mt-3 px-3 py-2 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground/60 mr-1">메모</span>
                    {it.note}
                  </div>
                )}

                {/* 3행: 승인완료/거절 처리 정보 */}
                {it.status !== "PENDING" && (it.approvedBy || it.decidedAt) && (
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    {it.approvedBy && (
                      <span>처리자 <strong className="text-foreground">{it.approvedBy.name}</strong></span>
                    )}
                    {it.decidedAt && (
                      <span>처리일 <strong className="text-foreground">{fmtDate(it.decidedAt)}</strong></span>
                    )}
                  </div>
                )}

                {/* 4행: 액션 버튼 (PENDING만) */}
                {it.status === "PENDING" && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => approve(it.id)}
                      disabled={workingId === it.id}
                      className="flex items-center gap-1.5 h-10 px-6 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {workingId === it.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          처리 중...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          승인하기
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
