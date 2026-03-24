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

      {/* ── Hero / Summary Card ── */}
      <section className="bg-card shadow-card rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1.5">운영 요약</p>
          <h1 className="text-3xl font-black text-foreground leading-tight break-keep m-0">
            제휴사 대시보드
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            잠재고객과 신청고객을 구분해서 확인하고, 신청고객에게만 포인트 지급 및 즉시 차감을 진행합니다.
          </p>
        </div>

        <div className="bg-muted/50 rounded-2xl px-4 py-3.5 w-full max-w-[280px] min-w-[200px]">
          <p className="text-xs text-muted-foreground mb-1.5">내 포인트 잔액</p>
          <p className="text-3xl font-black text-foreground">
            {balanceLoading ? "조회 중..." : `${formatNumber(myBalance)}P`}
          </p>
        </div>
      </section>

      {/* ── Top Grid: Topup Request + Topup History ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Topup Request Form */}
        <section className="bg-card shadow-card rounded-2xl p-5">
          <h2 className="text-lg font-black text-foreground mb-4">포인트 충전 요청</h2>

          <div className="flex gap-2.5 flex-wrap sm:flex-nowrap">
            <Input
              value={topupAmountText}
              onChange={(e) => setTopupAmountText(String(onlyDigitsToNumber(e.target.value)))}
              inputMode="numeric"
              placeholder="충전 요청 금액"
              className="min-w-0 flex-1 h-11"
            />
            <Button onClick={createTopupRequest} className="h-11 px-5 font-bold whitespace-nowrap">
              충전 요청
            </Button>
          </div>

          <Input
            value={topupNote}
            onChange={(e) => setTopupNote(e.target.value)}
            placeholder="입금자명 / 메모"
            className="mt-2.5 h-11"
          />

          {topupMsg && (
            <p className="mt-3 text-sm font-bold leading-relaxed text-foreground">{topupMsg}</p>
          )}
        </section>

        {/* Topup History */}
        <section className="bg-card shadow-card rounded-2xl p-5">
          <h2 className="text-lg font-black text-foreground mb-4">내 충전 요청 내역</h2>

          {topupItems.length === 0 ? (
            <EmptyText text="충전 요청 내역이 없습니다." />
          ) : (
            <div className="grid gap-2.5">
              {topupItems.map((it) => (
                <div
                  key={it.id}
                  className="border border-border rounded-xl p-3.5 grid gap-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-foreground">{formatNumber(it.amount)}P</span>
                    <StatusBadge status={it.status} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    요청일: {formatDateText(it.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {it.decidedAt ? `처리일: ${formatDateText(it.decidedAt)}` : "처리 대기"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Customer Section ── */}
      <section className="bg-card shadow-card rounded-2xl p-5">

        {/* Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-4">
          <h2 className="text-lg font-black text-foreground whitespace-nowrap shrink-0">
            고객 포인트 처리
          </h2>

          {/* Filter chips */}
          <div className="flex gap-2 flex-wrap min-w-0">
            {(
              [
                { value: "ALL" as CustomerFilter, label: `전체 ${items.length}명` },
                { value: "LIKED" as CustomerFilter, label: `잠재고객 ${likedCount}명` },
                { value: "APPLIED" as CustomerFilter, label: `신청고객 ${appliedCount}명` },
              ] as { value: CustomerFilter; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCustomerFilter(value)}
                className={cn(
                  "h-9 px-4 rounded-full border text-sm font-black whitespace-nowrap transition-colors",
                  customerFilter === value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex gap-2 min-w-0 xl:ml-auto">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="고객 검색 (아이디/이름)"
              className="min-w-0 w-full xl:w-52 h-9"
            />
            <Button variant="outline" onClick={fetchCustomers} className="h-9 px-4 font-bold whitespace-nowrap">
              검색
            </Button>
          </div>
        </div>

        {/* Info banner */}
        <div className="mb-4 p-3.5 rounded-xl bg-muted/50 text-sm text-muted-foreground leading-relaxed">
          잠재고객은 고객이 업체를 찜한 상태이며 최소 정보만 확인할 수 있습니다. 신청고객은 고객이 상담/이용 신청을 완료한 상태이며 상세정보 확인과 포인트 지급, 즉시 차감이 가능합니다.
        </div>

        {error && (
          <p className="mb-2.5 text-sm font-black text-destructive">{error}</p>
        )}

        <p className="text-sm text-muted-foreground mb-3">
          {loading ? "불러오는 중..." : `총 ${items.length}명`}
        </p>

        {/* ── Unified Customer Card Grid ── */}
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
          {items.map((c) => {
            const isApplied = c.relationStatus === "APPLIED";

            return (
              <article
                key={c.id}
                className="border border-border rounded-2xl bg-background p-4 grid gap-3"
              >
                {/* Card top: badge + name + balance */}
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="mb-2">
                      <RelationBadge status={c.relationStatus} />
                    </div>
                    <div className="text-base font-black text-foreground leading-tight">{c.name}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">{c.username}</div>
                  </div>
                  <div className="text-lg font-black text-foreground whitespace-nowrap">
                    {isApplied ? `${formatNumber(c.balance ?? 0)}P` : "-"}
                  </div>
                </div>

                {/* Meta info */}
                <div className="p-3 rounded-xl bg-muted/50 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <strong className="block text-xs font-black text-foreground mb-0.5">
                      {isApplied ? "신청일" : "찜한 일시"}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {formatDateText(isApplied ? c.appliedAt : c.likedAt ?? c.createdAt)}
                    </span>
                  </div>
                  <div>
                    <strong className="block text-xs font-black text-foreground mb-0.5">전화번호</strong>
                    <span className="text-xs text-muted-foreground">
                      {isApplied ? c.phone || "-" : "비공개"}
                    </span>
                  </div>
                  <div>
                    <strong className="block text-xs font-black text-foreground mb-0.5">주소</strong>
                    <span className="text-xs text-muted-foreground">
                      {isApplied
                        ? [c.address, c.detailAddress].filter(Boolean).join(" ") || "-"
                        : "비공개"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {isApplied ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIssueAmountText("0");
                          setIssueNote("");
                          setIssueMsg("");
                          setModal({ type: "issue", customer: c });
                        }}
                        className="font-bold"
                      >
                        포인트 지급
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUseAmountText("0");
                          setUseNote("");
                          setUseMsg("");
                          setModal({ type: "use", customer: c });
                        }}
                        className="font-bold"
                      >
                        즉시 차감
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">
                      신청 완료 후 포인트 처리 가능
                    </span>
                  )}
                </div>
              </article>
            );
          })}

          {!loading && items.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {customerFilter === "LIKED"
                ? "잠재고객이 없습니다."
                : customerFilter === "APPLIED"
                ? "신청고객이 없습니다."
                : "고객이 없습니다."}
            </div>
          )}
        </div>
      </section>

      {/* ── Point Processing Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 grid gap-4">
            {/* Modal header */}
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="text-lg font-black text-foreground">
                  {modal.type === "issue" ? "포인트 지급" : "즉시 차감"}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {modal.customer.name} ({modal.customer.username})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Customer info summary */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/50">
              <div>
                <strong className="block text-xs font-black text-foreground mb-1">전화번호</strong>
                <span className="text-sm text-muted-foreground">{modal.customer.phone || "-"}</span>
              </div>
              <div>
                <strong className="block text-xs font-black text-foreground mb-1">현재 잔액</strong>
                <span className="text-sm font-black text-foreground">
                  {formatNumber(modal.customer.balance ?? 0)}P
                </span>
              </div>
              <div className="col-span-2">
                <strong className="block text-xs font-black text-foreground mb-1">주소</strong>
                <span className="text-sm text-muted-foreground">
                  {[modal.customer.address, modal.customer.detailAddress].filter(Boolean).join(" ") || "-"}
                </span>
              </div>
            </div>

            {/* Issue form */}
            {modal.type === "issue" ? (
              <>
                <div className="flex gap-2.5">
                  <Input
                    value={issueAmountText}
                    onChange={(e) => setIssueAmountText(formatNumber(onlyDigitsToNumber(e.target.value)))}
                    inputMode="numeric"
                    placeholder="지급 포인트"
                    className="flex-1 min-w-0 h-11 text-right font-black"
                  />
                  <Button
                    onClick={() => createIssueRequest(modal.customer)}
                    className="h-11 px-5 font-bold whitespace-nowrap"
                  >
                    즉시 지급
                  </Button>
                </div>
                <Input
                  value={issueNote}
                  onChange={(e) => setIssueNote(e.target.value)}
                  placeholder="메모(선택)"
                  className="h-11"
                />
                {issueMsg && (
                  <p className="text-sm font-bold text-foreground leading-relaxed">{issueMsg}</p>
                )}
              </>
            ) : (
              <>
                <div className="flex gap-2.5">
                  <Input
                    value={useAmountText}
                    onChange={(e) => setUseAmountText(formatNumber(onlyDigitsToNumber(e.target.value)))}
                    inputMode="numeric"
                    placeholder="차감 포인트"
                    className="flex-1 min-w-0 h-11 text-right font-black"
                  />
                  <Button
                    onClick={() => useDirect(modal.customer)}
                    className="h-11 px-5 font-bold whitespace-nowrap"
                  >
                    즉시 차감 실행
                  </Button>
                </div>
                <Input
                  value={useNote}
                  onChange={(e) => setUseNote(e.target.value)}
                  placeholder="사용처 / 주문번호 / 메모"
                  className="h-11"
                />
                {useMsg && (
                  <p className="text-sm font-bold text-foreground leading-relaxed">{useMsg}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Grid: Issue History + Point History ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Issue Requests History */}
        <section className="bg-card shadow-card rounded-2xl p-5">
          <div className="flex justify-between items-center gap-2.5 flex-wrap mb-4">
            <h2 className="text-lg font-black text-foreground">최근 고객 지급 이력</h2>
            <Button variant="outline" size="sm" onClick={fetchMyIssueRequests} className="font-bold">
              새로고침
            </Button>
          </div>

          {reqLoading ? (
            <EmptyText text="불러오는 중..." />
          ) : reqItems.length === 0 ? (
            <EmptyText text="지급 이력이 없습니다." />
          ) : (
            <div className="grid gap-2.5">
              {reqItems.map((it) => (
                <div
                  key={it.id}
                  className="border border-border rounded-xl p-3.5 grid gap-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-foreground">
                      {it.to?.name} ({it.to?.username})
                    </span>
                    <span className="font-black text-sm text-foreground">{formatNumber(it.amount)}P</span>
                    <StatusBadge status={it.status} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    실행일: {formatDateText(it.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {it.decidedAt ? `처리시각: ${formatDateText(it.decidedAt)}` : "-"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Point History */}
        <section className="bg-card shadow-card rounded-2xl p-5">
          <div className="flex justify-between items-center gap-2.5 flex-wrap mb-4">
            <h2 className="text-lg font-black text-foreground">최근 포인트 처리 이력</h2>
            <Button variant="outline" size="sm" onClick={fetchPointHistory} className="font-bold">
              새로고침
            </Button>
          </div>

          {historyLoading ? (
            <EmptyText text="불러오는 중..." />
          ) : historyItems.length === 0 ? (
            <EmptyText text="처리 이력이 없습니다." />
          ) : (
            <div className="grid gap-2.5">
              {historyItems.map((it) => (
                <div
                  key={it.id}
                  className="border border-border rounded-xl p-3.5 grid gap-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-foreground">
                      {it.customer?.name} ({it.customer?.username})
                    </span>
                    <Badge
                      variant={it.type === "ISSUE" ? "secondary" : "outline"}
                      className={cn(
                        "font-bold text-xs",
                        it.type === "ISSUE"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "text-orange-600 border-orange-200 bg-orange-50"
                      )}
                    >
                      {pointHistoryTypeLabel(it.type)}
                    </Badge>
                  </div>
                  <p className="text-sm font-black text-foreground leading-relaxed">
                    {it.type === "ISSUE" ? "+" : "-"}{formatNumber(Math.abs(it.amount))}P
                  </p>
                  {it.note && (
                    <p className="text-xs text-muted-foreground leading-relaxed">메모: {it.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    처리시각: {formatDateText(it.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
