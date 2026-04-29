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
};

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "COMPLETED", label: "발송 완료" },
  { value: "FAILED", label: "실패" },
  { value: "REFUNDED", label: "환불 완료" },
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
  const [refunding, setRefunding] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  async function load(p = page, status = statusFilter, per = period) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), period: per });
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
    load(1, statusFilter, period);
    setPage(1);
  }, [statusFilter, period]);

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-foreground">주문 내역</h1>
          <p className="text-sm text-muted-foreground mt-1">전체 {total.toLocaleString()}건</p>
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

      {/* 기간 필터 */}
      <div className="flex gap-2 flex-wrap mb-3">
        {[
          { value: "today", label: "오늘" },
          { value: "week", label: "1주일" },
          { value: "month", label: "이번달" },
          { value: "all", label: "전체" },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPeriod(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
              period === opt.value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
              statusFilter === opt.value
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
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
            const canRefund = ["FAILED", "POINT_DEDUCTED", "SMARTCON_CALLED"].includes(order.status);

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
