"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Clock, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Order = {
  id: string;
  customerName: string;
  customerUsername: string;
  productName: string;
  productBrand: string;
  pointsSpent: number;
  status: string;
  pinNumber: string;
  failReason: string;
  smartconRetryCount: number;
  expiresAt: string | null;
  refundedAt: string | null;
  createdAt: string | null;
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETED: { label: "발송 완료", color: "text-green-700", bg: "bg-green-50" },
  REFUNDED: { label: "환불 완료", color: "text-blue-600", bg: "bg-blue-50" },
  FAILED: { label: "실패", color: "text-red-600", bg: "bg-red-50" },
  PENDING: { label: "처리 중", color: "text-yellow-600", bg: "bg-yellow-50" },
  POINT_DEDUCTED: { label: "포인트 차감됨", color: "text-yellow-600", bg: "bg-yellow-50" },
  SMARTCON_CALLED: { label: "발송 중", color: "text-yellow-600", bg: "bg-yellow-50" },
  REFUND_FAILED: { label: "환불 실패 · 수동처리 필요", color: "text-red-700", bg: "bg-red-100" },
};

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "COMPLETED", label: "발송 완료" },
  { value: "FAILED", label: "실패" },
  { value: "REFUNDED", label: "환불 완료" },
  { value: "REFUND_FAILED", label: "환불 실패" },
  { value: "PENDING", label: "처리 중" },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatPoint(value: number) {
  return Number(value || 0).toLocaleString();
}

export default function AdminShopOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [period, setPeriod] = useState("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [refunding, setRefunding] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  async function load(p = page, status = statusFilter, per = period, from = fromDate, to = toDate) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (from || to) {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      } else {
        params.set("period", per);
      }
      if (status) params.set("status", status);

      const res = await fetch(`/api/admin/shop/orders?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) {
        setOrders(Array.isArray(data.items) ? data.items : []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, statusFilter, period, fromDate, toDate);
    setPage(1);
  }, [statusFilter, period]);

  function handleDateSearch() {
    setPeriod("");
    load(1, statusFilter, "", fromDate, toDate);
    setPage(1);
  }

  function handlePeriod(per: string) {
    setPeriod(per);
    setFromDate("");
    setToDate("");
  }

  async function handleRefund(orderId: string, customerName: string, pointsSpent: number) {
    if (!confirm(`${customerName}님의 주문을 취소하고 ${formatPoint(pointsSpent)}P를 환불하시겠습니까?`)) return;
    setRefunding(orderId);
    try {
      const res = await fetch("/api/admin/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data?.ok) {
        toast.success("환불이 완료되었습니다.");
        load(page, statusFilter);
      } else {
        toast.error(data?.error ?? "환불 실패");
      }
    } finally {
      setRefunding(null);
    }
  }

  const PERIOD_OPTIONS = [
    { value: "today", label: "오늘" },
    { value: "week", label: "이번주" },
    { value: "month", label: "이번달" },
    { value: "all", label: "전체" },
  ];

  const isCustomRange = !!(fromDate || toDate);

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-foreground">주문 내역</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            조회된 주문 <span className="font-bold text-foreground">{total.toLocaleString()}건</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(page, statusFilter)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* 필터 카드 */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5 space-y-3">

        {/* 기간 + 날짜 직접입력 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 세그먼트 컨트롤 */}
          <div className="inline-flex rounded-xl border border-border overflow-hidden shrink-0">
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.value && !isCustomRange;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePeriod(opt.value)}
                  className={`px-3.5 py-2 text-sm font-bold transition-all border-r border-border last:border-r-0 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* 날짜 직접입력 */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`h-9 rounded-xl border px-3 text-sm text-foreground bg-background outline-none transition-all ${
                isCustomRange ? "border-primary ring-1 ring-primary/20" : "border-border focus:border-primary"
              }`}
            />
            <span className="text-muted-foreground font-bold text-sm">—</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`h-9 rounded-xl border px-3 text-sm text-foreground bg-background outline-none transition-all ${
                isCustomRange ? "border-primary ring-1 ring-primary/20" : "border-border focus:border-primary"
              }`}
            />
            <button
              type="button"
              onClick={handleDateSearch}
              disabled={!fromDate && !toDate}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-all"
            >
              조회
            </button>
            {isCustomRange && (
              <button
                type="button"
                onClick={() => { setFromDate(""); setToDate(""); handlePeriod("today"); }}
                className="h-9 px-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 구분선 */}
        <div className="border-t border-border" />

        {/* 상태 필터 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-muted-foreground shrink-0">상태</span>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* 주문 목록 */}
      {loading ? (
        <div className="text-center py-20 text-muted-foreground">불러오는 중...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground font-bold">
          주문 내역이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = STATUS_MAP[order.status] ?? {
              label: order.status,
              color: "text-muted-foreground",
              bg: "bg-muted",
            };
            const canRefund = ["FAILED", "POINT_DEDUCTED", "SMARTCON_CALLED", "REFUND_FAILED"].includes(order.status);

            return (
              <div
                key={order.id}
                className="bg-card border border-border rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                    </div>
                    <p className="text-sm font-black text-foreground">
                      {order.customerName}{" "}
                      <span className="text-muted-foreground font-semibold">
                        ({order.customerUsername})
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {order.productBrand} · {order.productName}
                    </p>
                    <p className="text-sm font-black text-primary mt-0.5">
                      {formatPoint(order.pointsSpent)}P 차감
                    </p>
                    {order.pinNumber && (
                      <p className="text-xs text-muted-foreground mt-1">
                        핀번호: <span className="font-bold text-foreground tracking-widest">{order.pinNumber}</span>
                      </p>
                    )}
                    {order.failReason && (
                      <p className="text-xs text-destructive mt-1">실패 사유: {order.failReason}</p>
                    )}
                    {order.refundedAt && (
                      <p className="text-xs text-blue-500 mt-1">
                        환불일시: {formatDate(order.refundedAt)}
                      </p>
                    )}
                  </div>
                  {canRefund && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRefund(order.id, order.customerName, order.pointsSpent)}
                      disabled={refunding === order.id}
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 font-bold flex-shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {refunding === order.id ? "처리 중..." : "환불"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); load(p, statusFilter); }}
            className="font-bold"
          >
            이전
          </Button>
          <span className="text-sm text-muted-foreground font-semibold">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => { const p = page + 1; setPage(p); load(p, statusFilter); }}
            className="font-bold"
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
