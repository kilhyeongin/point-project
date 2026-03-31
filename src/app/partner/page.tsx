"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RelationStatus = "LIKED" | "APPLIED";

type CustomerItem = {
  id: string;
  username: string;
  name: string;
  createdAt?: string;
  likedAt?: string;
  appliedAt?: string | null;
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
  to: { username: string; name: string } | null;
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
  customer: { username: string; name: string } | null;
};

type CustomerFilter = "ALL" | "LIKED" | "APPLIED";

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

function pointHistoryTypeLabel(type: string) {
  if (type === "ISSUE") return "포인트 지급";
  if (type === "USE") return "포인트 차감";
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
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>("ALL");

  const [modal, setModal] = useState<{ type: "issue" | "use"; customer: CustomerItem } | null>(null);

  const [issueAmountText, setIssueAmountText] = useState("0");
  const [issueNote, setIssueNote] = useState("");
  const [issueMsg, setIssueMsg] = useState("");

  const [useAmountText, setUseAmountText] = useState("0");
  const [useNote, setUseNote] = useState("");
  const [useMsg, setUseMsg] = useState("");

  const [topupAmountText, setTopupAmountText] = useState("100000");
  const [topupNote, setTopupNote] = useState("");
  const [topupMsg, setTopupMsg] = useState("");
  const [topupItems, setTopupItems] = useState<TopupItem[]>([]);

  const [reqItems, setReqItems] = useState<IssueReqItem[]>([]);
  const [reqLoading, setReqLoading] = useState(false);

  const [historyItems, setHistoryItems] = useState<PointHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
        `✅ ${customer.username} 고객에게 ${formatNumber(issueAmountNum)}P 지급 완료 / 내 잔액 ${formatNumber(
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
      setUseMsg("신청고객에게만 즉시 차감할 수 있습니다.");
      return;
    }

    if (useAmountNum <= 0) {
      setUseMsg("차감 포인트를 1 이상 입력해주세요.");
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
        setUseMsg(data?.message ?? "즉시 차감 실패");
        return;
      }

      setUseMsg(
        `✅ ${customer.username} 고객 포인트 ${formatNumber(useAmountNum)}P 즉시 차감 완료 / 고객 잔액 ${formatNumber(
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

  async function createTopupRequest() {
    setTopupMsg("");

    if (topupAmountNum <= 0) {
      setTopupMsg("충전 요청 금액을 1 이상 입력해주세요.");
      return;
    }

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
        setTopupMsg(data?.message ?? "충전 요청 생성 실패");
        return;
      }

      setTopupMsg(`✅ 충전 요청이 등록되었습니다. (${formatNumber(topupAmountNum)}P)`);
      setTopupAmountText("100000");
      setTopupNote("");

      await fetchMyTopups();
    } catch {
      setTopupMsg("네트워크 오류");
    }
  }

  return (
    <main className="min-w-0 space-y-5">

      {/* ── 1. 핵심 지표 ── */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="rounded-2xl p-4 text-white col-span-3 sm:col-span-1"
          style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}
        >
          <p className="text-xs font-semibold opacity-75 mb-1">내 포인트 잔액</p>
          <p className="text-2xl font-black leading-none">
            {balanceLoading ? "—" : `${formatNumber(myBalance)}`}
            <span className="text-base ml-1 opacity-80">P</span>
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-card shadow-card">
          <p className="text-xs font-semibold text-muted-foreground mb-1">신청고객</p>
          <p className="text-2xl font-black text-foreground leading-none">
            {loading ? "—" : appliedCount}
            <span className="text-sm font-semibold text-muted-foreground ml-1">명</span>
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-card shadow-card">
          <p className="text-xs font-semibold text-muted-foreground mb-1">잠재고객</p>
          <p className="text-2xl font-black text-foreground leading-none">
            {loading ? "—" : likedCount}
            <span className="text-sm font-semibold text-muted-foreground ml-1">명</span>
          </p>
        </div>
      </div>

      {/* ── 2. 고객 포인트 처리 (핵심) ── */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-5">
          <div className="flex-1">
            <h2 className="text-lg font-black text-foreground">고객 포인트 처리</h2>
            <p className="text-xs text-muted-foreground mt-0.5">신청고객에게만 포인트 지급·차감이 가능합니다</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {([
              { value: "ALL" as CustomerFilter, label: `전체 ${items.length}` },
              { value: "APPLIED" as CustomerFilter, label: `신청 ${appliedCount}` },
              { value: "LIKED" as CustomerFilter, label: `잠재 ${likedCount}` },
            ] as { value: CustomerFilter; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCustomerFilter(value)}
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

          <div className="flex gap-2 min-w-0">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 / 아이디 검색"
              className="min-w-0 w-full xl:w-48 h-9"
            />
            <Button variant="outline" onClick={fetchCustomers} className="h-9 px-4 font-bold whitespace-nowrap shrink-0">
              검색
            </Button>
          </div>
        </div>

        {error && <p className="mb-3 text-sm font-black text-destructive">{error}</p>}

        {/* 신청고객 카드 */}
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
          {items.filter(c => c.relationStatus === "APPLIED").map((c) => (
            <article key={c.id} className="rounded-2xl border border-emerald-200 bg-background overflow-hidden">
              <div className="h-1 bg-emerald-400" />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base font-black text-foreground">{c.name}</span>
                      <RelationBadge status={c.relationStatus} />
                    </div>
                    <span className="text-xs text-muted-foreground">{c.username}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground mb-0.5">보유 포인트</p>
                    <p className="text-lg font-black text-foreground leading-none">
                      {formatNumber(c.balance ?? 0)}<span className="text-sm opacity-60 ml-0.5">P</span>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">신청일</span>
                    <p className="font-semibold text-foreground mt-0.5 truncate">{formatDateText(c.appliedAt)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">전화번호</span>
                    <p className="font-semibold text-foreground mt-0.5">{c.phone || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">주소</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {[c.address, c.detailAddress].filter(Boolean).join(" ") || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 font-bold h-9"
                    onClick={() => { setIssueAmountText("0"); setIssueNote(""); setIssueMsg(""); setModal({ type: "issue", customer: c }); }}>
                    포인트 지급
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 font-bold h-9"
                    onClick={() => { setUseAmountText("0"); setUseNote(""); setUseMsg(""); setModal({ type: "use", customer: c }); }}>
                    즉시 차감
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {!loading && items.filter(c => c.relationStatus === "APPLIED").length === 0 && customerFilter !== "LIKED" && (
            <div className="col-span-full py-6 text-center text-sm text-muted-foreground font-semibold">신청고객이 없습니다.</div>
          )}
        </div>

        {/* 잠재고객 리스트 */}
        {(customerFilter === "ALL" || customerFilter === "LIKED") && items.filter(c => c.relationStatus === "LIKED").length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-black text-muted-foreground mb-2 uppercase tracking-wide">잠재고객 ({likedCount}명)</p>
            <div className="rounded-xl border border-border overflow-hidden">
              {items.filter(c => c.relationStatus === "LIKED").map((c, i, arr) => (
                <div key={c.id} className={cn("flex items-center justify-between px-4 py-2.5 bg-background", i < arr.length - 1 && "border-b border-border/60")}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-muted-foreground">{c.name?.[0] ?? "?"}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">{c.username}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDateText(c.likedAt ?? c.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground font-semibold">등록된 고객이 없습니다.</p>
          </div>
        )}
        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
        )}

      </section>

      {/* ── 3. 충전 요청 + 충전 내역 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-card shadow-card rounded-2xl p-5">
          <h2 className="text-base font-black text-foreground mb-4">포인트 충전 요청</h2>
          <div className="flex gap-2.5 flex-wrap sm:flex-nowrap">
            <Input
              value={topupAmountText}
              onChange={(e) => setTopupAmountText(String(onlyDigitsToNumber(e.target.value)))}
              inputMode="numeric"
              placeholder="충전 요청 금액"
              className="min-w-0 flex-1 h-11"
            />
            <Button onClick={createTopupRequest} className="h-11 px-5 font-bold whitespace-nowrap">
              요청
            </Button>
          </div>
          <Input
            value={topupNote}
            onChange={(e) => setTopupNote(e.target.value)}
            placeholder="입금자명 / 메모"
            className="mt-2.5 h-11"
          />
          {topupMsg && <p className="mt-3 text-sm font-bold text-foreground">{topupMsg}</p>}
        </section>

        <section className="bg-card shadow-card rounded-2xl p-5">
          <h2 className="text-base font-black text-foreground mb-4">충전 요청 내역</h2>
          {topupItems.length === 0 ? (
            <EmptyText text="충전 요청 내역이 없습니다." />
          ) : (
            <div className="space-y-2">
              {topupItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
                  <div>
                    <p className="text-sm font-black text-foreground">{formatNumber(it.amount)}P</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateText(it.createdAt)}</p>
                  </div>
                  <StatusBadge status={it.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

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
            <div className="space-y-2">
              {reqItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{it.to?.name} <span className="font-normal text-muted-foreground">({it.to?.username})</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateText(it.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-black text-foreground">{formatNumber(it.amount)}P</span>
                    <StatusBadge status={it.status} />
                  </div>
                </div>
              ))}
            </div>
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
            <div className="space-y-2">
              {historyItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{it.customer?.name} <span className="font-normal text-muted-foreground">({it.customer?.username})</span></p>
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
          )}
        </section>
      </div>

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
                  {modal.type === "issue" ? "포인트 지급" : "즉시 차감"}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{modal.customer.name} ({modal.customer.username})</p>
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
                  <Input value={useAmountText} onChange={(e) => setUseAmountText(formatNumber(onlyDigitsToNumber(e.target.value)))} inputMode="numeric" placeholder="차감 포인트" className="flex-1 min-w-0 h-11 text-right font-black" />
                  <Button onClick={() => useDirect(modal.customer)} className="h-11 px-5 font-bold whitespace-nowrap">즉시 차감</Button>
                </div>
                <Input value={useNote} onChange={(e) => setUseNote(e.target.value)} placeholder="사용처 / 주문번호 / 메모" className="h-11" />
                {useMsg && <p className="text-sm font-bold text-foreground leading-relaxed">{useMsg}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
