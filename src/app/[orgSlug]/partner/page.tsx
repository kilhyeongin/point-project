"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RelationStatus = "LIKED" | "APPLIED";

type CustomerItem = {
  id: string;
  username: string;
  name: string;
  socialProvider?: string | null;
  createdAt?: string;
  likedAt?: string;
  appliedAt?: string | null;
  appointmentAt?: string | null;
  balance?: number;
  relationStatus: RelationStatus;
  isMasked?: boolean;
  phone?: string;
  address?: string;
  detailAddress?: string;
};

type IssueReqItem = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  amount: number;
  note?: string;
  createdAt: string;
  decidedAt?: string | null;
  to: { username: string; name: string; socialProvider?: string | null } | null;
};

type TopupItem = {
  id: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note?: string;
  createdAt: string;
  decidedAt?: string | null;
};

type PointHistoryItem = {
  id: string;
  type: "ISSUE" | "USE";
  amount: number;
  note?: string;
  createdAt: string;
  customer: { username: string; name: string; socialProvider?: string | null } | null;
};

type CustomerFilter = "ALL" | "APPLIED" | "LIKED" | "COMPLETED";

function onlyDigitsToNumber(v: string) {
  const digits = String(v ?? "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function statusLabel(s: string) {
  if (s === "PENDING") return "대기";
  if (s === "APPROVED") return "승인";
  if (s === "REJECTED") return "거절";
  return s;
}

function socialLabel(provider?: string | null) {
  if (provider === "kakao") return "카카오가입자";
  if (provider === "naver") return "네이버가입자";
  return null;
}

function pointHistoryTypeLabel(type: string, note: string = "") {
  const isQr = note.startsWith("QR");
  if (type === "ISSUE") return isQr ? "QR 적립" : "포인트 지급";
  if (type === "USE") return isQr ? "QR 사용" : "포인트 사용";
  return type;
}

function relationLabel(status: RelationStatus) {
  if (status === "LIKED") return "잠재고객";
  if (status === "APPLIED") return "신청고객";
  return status;
}

function formatDateText(v?: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return "-";
  }
}

function formatAppointmentDate(v?: string | null) {
  if (!v) return "미정";
  try {
    const d = new Date(v);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours < 12 ? "오전" : "오후";
    const h = hours % 12 === 0 ? 12 : hours % 12;
    const timeStr = minutes > 0 ? `${ampm} ${h}시 ${minutes}분` : `${ampm} ${h}시`;
    return `${month}/${day} ${timeStr}`;
  } catch {
    return "-";
  }
}

function StatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  if (status === "APPROVED") {
    return (
      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
        {statusLabel(status)}
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge variant="destructive" className="font-bold">
        {statusLabel(status)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground font-bold">
      {statusLabel(status)}
    </Badge>
  );
}

function RelationBadge({ status }: { status: RelationStatus }) {
  if (status === "APPLIED") {
    return (
      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-xs">
        {relationLabel(status)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground font-black text-xs">
      {relationLabel(status)}
    </Badge>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="text-sm text-muted-foreground leading-relaxed opacity-70">
      {text}
    </div>
  );
}

export default function PartnerPage() {
  const [myBalance, setMyBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [error, setError] = useState("");
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>("APPLIED");

  const [modal, setModal] = useState<{ type: "issue" | "use"; customer: CustomerItem } | null>(null);
  const [detailModal, setDetailModal] = useState<CustomerItem | null>(null);

  const [issueAmountText, setIssueAmountText] = useState("0");
  const [issueNote, setIssueNote] = useState("");
  const [issueMsg, setIssueMsg] = useState("");

  const [useAmountText, setUseAmountText] = useState("0");
  const [useNote, setUseNote] = useState("");
  const [useMsg, setUseMsg] = useState("");

  const [topupAmountText, setTopupAmountText] = useState("100,000");
  const [topupNote, setTopupNote] = useState("");
  const [topupMsg, setTopupMsg] = useState("");
  const [topupConfirming, setTopupConfirming] = useState(false);
  const [topupItems, setTopupItems] = useState<TopupItem[]>([]);

  const [reqItems, setReqItems] = useState<IssueReqItem[]>([]);
  const [reqLoading, setReqLoading] = useState(false);

  const [historyItems, setHistoryItems] = useState<PointHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleTopup, setVisibleTopup] = useState(5);
  const [visibleReq, setVisibleReq] = useState(5);
  const [visibleHistory, setVisibleHistory] = useState(5);
  const [visibleCount, setVisibleCount] = useState(6);
  const [pageStep, setPageStep] = useState(6);

  useEffect(() => {
    const step = window.innerWidth < 640 ? 3 : 6;
    setPageStep(step);
    setVisibleCount(step);
  }, []);

  const debouncedQ = useMemo(() => q.trim(), [q]);
  const issueAmountNum = useMemo(() => onlyDigitsToNumber(issueAmountText), [issueAmountText]);
  const useAmountNum = useMemo(() => onlyDigitsToNumber(useAmountText), [useAmountText]);
  const topupAmountNum = useMemo(() => onlyDigitsToNumber(topupAmountText), [topupAmountText]);

  const likedCount = useMemo(
    () => items.filter((item) => item.relationStatus === "LIKED").length,
    [items]
  );
  const appliedCount = useMemo(
    () => items.filter((item) => item.relationStatus === "APPLIED").length,
    [items]
  );
  const completedCount = useMemo(
    () => items.filter((item) => item.relationStatus === "APPLIED" && item.appointmentAt && new Date(item.appointmentAt) < new Date()).length,
    [items]
  );

  const filteredCustomers = useMemo(() => {
    const now = new Date();
    if (customerFilter === "LIKED") return items.filter(c => c.relationStatus === "LIKED");
    if (customerFilter === "COMPLETED") return items.filter(c => c.relationStatus === "APPLIED" && c.appointmentAt && new Date(c.appointmentAt) < now);
    return items.filter(c => c.relationStatus === "APPLIED");
  }, [items, customerFilter]);

  async function fetchMyBalance() {
    setBalanceLoading(true);
    try {
      const res = await fetch("/api/me/balance", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMyBalance(Number(data.balance ?? 0));
      }
    } finally {
      setBalanceLoading(false);
    }
  }

  async function fetchCustomers() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (customerFilter !== "ALL") params.set("status", customerFilter);

      const query = params.toString();
      const url = query ? `/api/requesters/customers?${query}` : "/api/requesters/customers";

      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "고객 목록 조회 실패");
        setItems([]);
        return;
      }

      setItems(
        Array.isArray(data?.items)
          ? data.items.map((item: any) => ({
              ...item,
              relationStatus: item?.relationStatus === "APPLIED" ? "APPLIED" : "LIKED",
              balance: Number(item?.balance ?? 0),
            }))
          : []
      );
    } catch {
      setError("네트워크 오류");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyIssueRequests() {
    setReqLoading(true);
    try {
      const res = await fetch("/api/partner/issue-requests", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setReqItems([]);
        return;
      }

      setReqItems(data?.items ?? []);
    } catch {
      setReqItems([]);
    } finally {
      setReqLoading(false);
    }
  }

  async function fetchMyTopups() {
    try {
      const res = await fetch("/api/topup-requests", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setTopupItems([]);
        return;
      }

      setTopupItems(data?.items ?? []);
    } catch {
      setTopupItems([]);
    }
  }

  async function fetchPointHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/partner/point-history", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setHistoryItems([]);
        return;
      }

      setHistoryItems(data?.items ?? []);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    fetchMyBalance();
    fetchCustomers();
    fetchMyIssueRequests();
    fetchMyTopups();
    fetchPointHistory();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchCustomers();
      setVisibleCount(pageStep);
    }, 250);

    return () => clearTimeout(t);
  }, [debouncedQ, customerFilter]);

  async function createIssueRequest(customer: CustomerItem) {
    setIssueMsg("");

    if (customer.relationStatus !== "APPLIED") {
      setIssueMsg("신청고객에게만 포인트를 지급할 수 있습니다.");
      return;
    }

    if (issueAmountNum <= 0) {
      setIssueMsg("지급 포인트를 1 이상 입력해주세요.");
      return;
    }

    try {
      const res = await fetch("/api/issue-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: customer.id,
          amount: issueAmountNum,
          note: issueNote.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setIssueMsg(data?.message ?? "포인트 지급 실패");
        return;
      }

      setIssueMsg(
        `✅ ${socialLabel(customer.socialProvider) ?? customer.username} 고객에게 ${formatNumber(issueAmountNum)}P 지급 완료 / 내 잔액 ${formatNumber(
          data.balanceAfter ?? 0
        )}P`
      );

      setModal(null);
      setIssueAmountText("0");
      setIssueNote("");

      await fetchMyBalance();
      await fetchCustomers();
      await fetchMyIssueRequests();
      await fetchPointHistory();
    } catch {
      setIssueMsg("네트워크 오류");
    }
  }

  async function useDirect(customer: CustomerItem) {
    setUseMsg("");

    if (customer.relationStatus !== "APPLIED") {
      setUseMsg("신청고객에게만 즉시 포인트 사용 처리할 수 있습니다.");
      return;
    }

    if (useAmountNum <= 0) {
      setUseMsg("사용 포인트를 1 이상 입력해주세요.");
      return;
    }

    try {
      const res = await fetch("/api/partner/use-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: customer.id,
          amount: useAmountNum,
          note: useNote.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setUseMsg(data?.message ?? "포인트 사용 실패");
        return;
      }

      setUseMsg(
        `✅ ${socialLabel(customer.socialProvider) ?? customer.username} 고객 포인트 ${formatNumber(useAmountNum)}P 사용 완료 / 고객 잔액 ${formatNumber(
          data.balanceAfter ?? 0
        )}P`
      );

      setModal(null);
      setUseAmountText("0");
      setUseNote("");

      await fetchCustomers();
      await fetchPointHistory();
    } catch {
      setUseMsg("네트워크 오류");
    }
  }

  function requestTopupConfirm() {
    setTopupMsg("");
    if (topupAmountNum <= 0) {
      setTopupMsg("충전 요청 금액을 1 이상 입력해주세요.");
      return;
    }
    setTopupConfirming(true);
  }

  async function createTopupRequest() {
    setTopupConfirming(false);
    try {
      const res = await fetch("/api/topup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: topupAmountNum,
          note: topupNote.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        toast.error(data?.message ?? "충전 요청 생성 실패");
        return;
      }

      toast.success(`${formatNumber(topupAmountNum)}P 충전 요청이 등록되었습니다.`);
      setTopupAmountText("100,000");
      setTopupNote("");

      await fetchMyTopups();
    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
    }
  }

  async function cancelTopupRequest(id: string) {
    if (!confirm("충전 요청을 취소하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/topup-requests/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data?.message ?? "취소에 실패했습니다.");
        return;
      }
      await fetchMyTopups();
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  }

  return (
    <main className="min-w-0 space-y-5 max-w-5xl">

      {/* ── 1. 핵심 지표 ── */}
      <div className="flex sm:grid sm:grid-cols-2 gap-3">
        <div
          className="rounded-2xl p-4 text-white flex-1 sm:flex-none"
          style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}
        >
          <p className="text-xs font-semibold opacity-75 mb-1">내 포인트 잔액</p>
          <p className="text-2xl font-black leading-none">
            {balanceLoading ? "—" : `${formatNumber(myBalance)}`}
            <span className="text-base ml-1 opacity-80">P</span>
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-card shadow-card shrink-0 sm:shrink">
          <p className="text-xs font-semibold text-muted-foreground mb-1">상담신청 고객</p>
          <p className="text-2xl font-black text-foreground leading-none">
            {loading ? "—" : appliedCount}
            <span className="text-sm font-semibold text-muted-foreground ml-1">명</span>
          </p>
        </div>
      </div>

      {/* ── 2. 고객 포인트 처리 (핵심) ── */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-black text-foreground">상담신청 고객 포인트 관리</h2>
              <p className="text-xs text-muted-foreground mt-0.5">신청고객에게만 포인트 지급·사용이 가능합니다</p>
            </div>
            <div className="flex gap-2 min-w-0">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="이름 검색"
                className="min-w-0 w-full sm:w-40 h-9"
              />
              <Button variant="outline" onClick={fetchCustomers} className="h-9 px-4 font-bold whitespace-nowrap shrink-0">
                검색
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            {([
              { value: "APPLIED" as CustomerFilter, label: `상담신청 ${appliedCount}` },
              { value: "LIKED" as CustomerFilter, label: `잠재고객 ${likedCount}` },
              { value: "COMPLETED" as CustomerFilter, label: `계약 완료 ${completedCount}` },
            ]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setCustomerFilter(value); setVisibleCount(pageStep); }}
                className={cn(
                  "h-8 px-3.5 rounded-full border text-xs font-black whitespace-nowrap transition-colors",
                  customerFilter === value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mb-3 text-sm font-black text-destructive">{error}</p>}

        {/* 고객 카드/리스트 */}
        {customerFilter === "LIKED" ? (
          filteredCustomers.length === 0 && !loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground font-semibold">잠재고객이 없습니다.</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              {filteredCustomers.map((c, i, arr) => (
                <div key={c.id} className={cn("flex items-center justify-between px-4 py-3 bg-background", i < arr.length - 1 && "border-b border-border/60")}>
                  <span className="text-sm font-bold text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDateText(c.likedAt ?? c.createdAt)}</span>
                </div>
              ))}
            </div>
          )
        ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCustomers.slice(0, visibleCount).map((c) => (
            <article key={c.id} className="rounded-2xl border border-border bg-background overflow-hidden">
              {/* 방문일 강조 헤더 */}
              <div className={cn(
                "px-4 py-3 flex items-center justify-between",
                c.appointmentAt ? "bg-blue-50 border-b border-blue-200" : "bg-muted/40 border-b border-border"
              )}>
                <span className={cn("text-xs font-bold", c.appointmentAt ? "text-blue-500" : "text-muted-foreground")}>방문일</span>
                <span className={cn("text-sm font-black", c.appointmentAt ? "text-blue-700" : "text-muted-foreground")}>
                  {formatAppointmentDate(c.appointmentAt)}
                </span>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-black text-foreground leading-tight">{c.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.phone || "-"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">보유 포인트</p>
                    <p className="text-base font-black text-foreground">{formatNumber(c.balance ?? 0)}<span className="text-xs opacity-60 ml-0.5">P</span></p>
                  </div>
                </div>
                <Button size="sm" className="w-full font-bold h-9 mt-2" onClick={() => setDetailModal(c)}>
                  고객 포인트 관리
                </Button>
              </div>
            </article>
          ))}
          {!loading && filteredCustomers.length === 0 && (
            <div className="col-span-full py-6 text-center text-sm text-muted-foreground font-semibold">
              {customerFilter === "COMPLETED" ? "계약 완료 고객이 없습니다." : "신청고객이 없습니다."}
            </div>
          )}
        </div>
        )}
        {customerFilter !== "LIKED" && (() => {
          if (filteredCustomers.length > visibleCount) {
            return (
              <button
                type="button"
                onClick={() => setVisibleCount(v => v + pageStep)}
                className="w-full mt-2 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                더보기 ({filteredCustomers.length - visibleCount}명 남음)
              </button>
            );
          }
          if (filteredCustomers.length > pageStep && visibleCount > pageStep) {
            return (
              <button
                type="button"
                onClick={() => setVisibleCount(pageStep)}
                className="w-full mt-2 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                접기
              </button>
            );
          }
          return null;
        })()}

        {!loading && items.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground font-semibold">등록된 고객이 없습니다.</p>
          </div>
        )}
        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
        )}

      </section>

      {/* ── 3·4. 검색 중일 때: 해당 고객 포인트 이력 / 아닐 때: 전체 섹션 ── */}
      {debouncedQ ? (
        <section className="bg-card shadow-card rounded-2xl p-5">
          <h2 className="text-base font-black text-foreground mb-4">"{debouncedQ}" 포인트 처리 이력</h2>
          {(() => {
            const filtered = historyItems.filter(it =>
              String(it.customer?.name ?? "").toLowerCase().includes(debouncedQ.toLowerCase())
            );
            if (historyLoading) return <EmptyText text="불러오는 중..." />;
            if (filtered.length === 0) return <EmptyText text="처리 이력이 없습니다." />;
            return (
              <div className="space-y-2">
                {filtered.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground truncate">{it.customer?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateText(it.createdAt)}</p>
                      {it.note && <p className="text-xs text-muted-foreground truncate">메모: {it.note}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-sm font-black", it.type === "ISSUE" ? "text-blue-600" : "text-orange-500")}>
                        {it.type === "ISSUE" ? "+" : "-"}{formatNumber(Math.abs(it.amount))}P
                      </span>
                      <Badge
                        variant={it.type === "ISSUE" ? "secondary" : "outline"}
                        className={cn("font-bold text-xs", it.type === "ISSUE" ? "bg-blue-50 text-blue-700 border-blue-200" : "text-orange-600 border-orange-200 bg-orange-50")}
                      >
                        {pointHistoryTypeLabel(it.type)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      ) : (
        <>
          {/* ── 3. 충전 요청 + 충전 내역 (통합) ── */}
          <section className="bg-card shadow-card rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-base font-black text-foreground mb-4">관리자에게 포인트 충전 요청</h2>
              <div className="flex gap-2.5 flex-wrap sm:flex-nowrap">
                <Input
                  value={topupAmountText}
                  onChange={(e) => { setTopupAmountText(formatNumber(onlyDigitsToNumber(e.target.value))); setTopupConfirming(false); }}
                  inputMode="numeric"
                  placeholder="충전 요청 금액"
                  className="min-w-0 flex-1 h-11"
                  disabled={topupConfirming}
                />
                <Button onClick={requestTopupConfirm} className="h-11 px-5 font-bold whitespace-nowrap" disabled={topupConfirming}>
                  요청
                </Button>
              </div>
              <Input
                value={topupNote}
                onChange={(e) => { setTopupNote(e.target.value); setTopupConfirming(false); }}
                placeholder="메모(선택)"
                className="mt-2.5 h-11"
                disabled={topupConfirming}
              />
              {topupMsg && <p className="mt-3 text-sm font-bold text-destructive">{topupMsg}</p>}

              {/* 확인 단계 */}
              {topupConfirming && (
                <div className="mt-3 p-4 rounded-xl border border-border bg-muted/40 space-y-3">
                  <p className="text-sm font-black text-foreground">
                    <span style={{ color: "oklch(0.52 0.27 264)" }}>{formatNumber(topupAmountNum)}P</span> 충전을 관리자에게 요청하시겠습니까?
                  </p>
                  {topupNote && <p className="text-xs text-muted-foreground">메모: {topupNote}</p>}
                  <div className="flex gap-2">
                    <Button onClick={createTopupRequest} className="flex-1 h-10 font-bold">
                      확인
                    </Button>
                    <Button variant="outline" onClick={() => setTopupConfirming(false)} className="flex-1 h-10 font-bold">
                      취소
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-5">
              <h2 className="text-base font-black text-foreground mb-4">충전 요청 내역</h2>
              {topupItems.length === 0 ? (
                <EmptyText text="충전 요청 내역이 없습니다." />
              ) : (
                <>
                  <div className="space-y-2">
                    {topupItems.slice(0, visibleTopup).map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
                        <div>
                          <p className="text-sm font-black text-foreground">{formatNumber(it.amount)}P</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDateText(it.createdAt)}</p>
                          {it.note && <p className="text-xs text-muted-foreground truncate">메모: {it.note}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={it.status} />
                          {it.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => cancelTopupRequest(it.id)}
                              className="h-7 px-2.5 rounded-lg text-xs font-bold text-destructive border border-destructive/30 hover:bg-destructive/8 transition-colors"
                            >
                              취소
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {topupItems.length > visibleTopup && (
                    <button type="button" onClick={() => setVisibleTopup(v => v + 5)} className="w-full mt-3 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted/30 transition-colors">
                      더보기 ({topupItems.length - visibleTopup}건 남음)
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ── 4. 이력 ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section className="bg-card shadow-card rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-black text-foreground">고객 지급 이력</h2>
                <Button variant="outline" size="sm" onClick={fetchMyIssueRequests} className="font-bold h-8 px-3 text-xs">
                  새로고침
                </Button>
              </div>
              {reqLoading ? <EmptyText text="불러오는 중..." /> : reqItems.length === 0 ? <EmptyText text="지급 이력이 없습니다." /> : (
                <>
                  <div className="space-y-2">
                    {reqItems.slice(0, visibleReq).map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground truncate">{it.to ? <>{it.to.name}{(socialLabel(it.to.socialProvider) ?? it.to.username) ? <span className="font-normal text-muted-foreground"> ({socialLabel(it.to.socialProvider) ?? it.to.username})</span> : null}</> : <span className="text-muted-foreground font-normal">회원탈퇴 고객</span>}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDateText(it.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-black text-foreground">{formatNumber(it.amount)}P</span>
                          <StatusBadge status={it.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {reqItems.length > visibleReq && (
                    <button type="button" onClick={() => setVisibleReq(v => v + 5)} className="w-full mt-3 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted/30 transition-colors">
                      더보기 ({reqItems.length - visibleReq}건 남음)
                    </button>
                  )}
                </>
              )}
            </section>

            <section className="bg-card shadow-card rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-black text-foreground">포인트 처리 이력</h2>
                <Button variant="outline" size="sm" onClick={fetchPointHistory} className="font-bold h-8 px-3 text-xs">
                  새로고침
                </Button>
              </div>
              {historyLoading ? <EmptyText text="불러오는 중..." /> : historyItems.length === 0 ? <EmptyText text="처리 이력이 없습니다." /> : (
                <>
                  <div className="space-y-2">
                    {historyItems.slice(0, visibleHistory).map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground truncate">{it.customer ? <>{it.customer.name}{(socialLabel(it.customer.socialProvider) ?? it.customer.username) ? <span className="font-normal text-muted-foreground"> ({socialLabel(it.customer.socialProvider) ?? it.customer.username})</span> : null}</> : <span className="text-muted-foreground font-normal">회원탈퇴 고객</span>}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDateText(it.createdAt)}</p>
                          {it.note && <p className="text-xs text-muted-foreground truncate">메모: {it.note}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-sm font-black", it.type === "ISSUE" ? "text-blue-600" : "text-orange-500")}>
                            {it.type === "ISSUE" ? "+" : "-"}{formatNumber(Math.abs(it.amount))}P
                          </span>
                          <Badge
                            variant={it.type === "ISSUE" ? "secondary" : "outline"}
                            className={cn("font-bold text-xs", it.type === "ISSUE" ? "bg-blue-50 text-blue-700 border-blue-200" : "text-orange-600 border-orange-200 bg-orange-50")}
                          >
                            {pointHistoryTypeLabel(it.type, it.note)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {historyItems.length > visibleHistory && (
                    <button type="button" onClick={() => setVisibleHistory(v => v + 5)} className="w-full mt-3 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted/30 transition-colors">
                      더보기 ({historyItems.length - visibleHistory}건 남음)
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}

      {/* ── 포인트 처리 모달 ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 grid gap-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="text-lg font-black text-foreground">
                  {modal.type === "issue" ? "포인트 지급" : "포인트 사용"}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{modal.customer.name} ({socialLabel(modal.customer.socialProvider) ?? modal.customer.username})</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/50">
              <div>
                <strong className="block text-xs font-black text-foreground mb-1">전화번호</strong>
                <span className="text-sm text-muted-foreground">{modal.customer.phone || "-"}</span>
              </div>
              <div>
                <strong className="block text-xs font-black text-foreground mb-1">현재 잔액</strong>
                <span className="text-sm font-black text-foreground">{formatNumber(modal.customer.balance ?? 0)}P</span>
              </div>
              <div className="col-span-2">
                <strong className="block text-xs font-black text-foreground mb-1">주소</strong>
                <span className="text-sm text-muted-foreground">{[modal.customer.address, modal.customer.detailAddress].filter(Boolean).join(" ") || "-"}</span>
              </div>
            </div>

            {modal.type === "issue" ? (
              <>
                <div className="flex gap-2.5">
                  <Input value={issueAmountText} onChange={(e) => setIssueAmountText(formatNumber(onlyDigitsToNumber(e.target.value)))} inputMode="numeric" placeholder="지급 포인트" className="flex-1 min-w-0 h-11 text-right font-black" />
                  <Button onClick={() => createIssueRequest(modal.customer)} className="h-11 px-5 font-bold whitespace-nowrap">즉시 지급</Button>
                </div>
                <Input value={issueNote} onChange={(e) => setIssueNote(e.target.value)} placeholder="메모(선택)" className="h-11" />
                {issueMsg && <p className="text-sm font-bold text-foreground leading-relaxed">{issueMsg}</p>}
              </>
            ) : (
              <>
                <div className="flex gap-2.5">
                  <Input value={useAmountText} onChange={(e) => setUseAmountText(formatNumber(onlyDigitsToNumber(e.target.value)))} inputMode="numeric" placeholder="사용 포인트" className="flex-1 min-w-0 h-11 text-right font-black" />
                  <Button onClick={() => useDirect(modal.customer)} className="h-11 px-5 font-bold whitespace-nowrap">포인트 사용</Button>
                </div>
                <Input value={useNote} onChange={(e) => setUseNote(e.target.value)} placeholder="메모(선택)" className="h-11" />
                {useMsg && <p className="text-sm font-bold text-foreground leading-relaxed">{useMsg}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 고객 상세 모달 ── */}
      {detailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailModal(null); }}
        >
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-foreground">{detailModal.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{socialLabel(detailModal.socialProvider) ?? detailModal.username}</p>
              </div>
              <button type="button" onClick={() => setDetailModal(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
            </div>

            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-blue-500">방문일</p>
                <p className="text-base font-black text-blue-700 mt-0.5">{formatAppointmentDate(detailModal.appointmentAt)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground font-bold mb-1">신청일</p>
                  <p className="font-semibold text-foreground text-xs">{formatDateText(detailModal.appliedAt)}</p>
                </div>
                <div className="bg-muted/50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground font-bold mb-1">보유 포인트</p>
                  <p className="font-black text-foreground">{formatNumber(detailModal.balance ?? 0)}P</p>
                </div>
                <div className="bg-muted/50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-muted-foreground font-bold mb-1">전화번호</p>
                  <p className="font-semibold text-foreground">{detailModal.phone || "-"}</p>
                </div>
                <div className="bg-muted/50 rounded-xl px-3 py-2.5 col-span-2">
                  <p className="text-xs text-muted-foreground font-bold mb-1">주소</p>
                  <p className="font-semibold text-foreground">{[detailModal.address, detailModal.detailAddress].filter(Boolean).join(" ") || "-"}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1 font-bold h-10" onClick={() => { setIssueAmountText("0"); setIssueNote(""); setIssueMsg(""); setDetailModal(null); setModal({ type: "issue", customer: detailModal }); }}>
                  포인트 지급
                </Button>
                <Button variant="outline" className="flex-1 font-bold h-10" onClick={() => { setUseAmountText("0"); setUseNote(""); setUseMsg(""); setDetailModal(null); setModal({ type: "use", customer: detailModal }); }}>
                  포인트 사용
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
