"use client";

import { useState, useEffect } from "react";
import CustomerShellClient from "../../CustomerShellClient";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, CheckCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";

type SessionInfo = { uid: string; username: string; name: string; role: string };

type Order = {
  id: string;
  productName: string;
  productBrand: string;
  pointsSpent: number;
  status: string;
  pinNumber: string;
  pinUrl: string;
  expiresAt: string | null;
  refundedAt: string | null;
  createdAt: string | null;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  COMPLETED: { label: "발송 완료", color: "text-green-600", icon: CheckCircle },
  REFUNDED: { label: "환불 완료", color: "text-blue-500", icon: RefreshCw },
  FAILED: { label: "실패", color: "text-destructive", icon: AlertCircle },
  PENDING: { label: "처리 중", color: "text-muted-foreground", icon: Clock },
  POINT_DEDUCTED: { label: "처리 중", color: "text-muted-foreground", icon: Clock },
  SMARTCON_CALLED: { label: "처리 중", color: "text-muted-foreground", icon: Clock },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatPoint(value: number) {
  return Number(value || 0).toLocaleString();
}

export default function CustomerShopOrdersClient({
  session,
  orgSlug,
}: {
  session: SessionInfo;
  orgSlug: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function fetchOrders(p: number, append = false) {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/customer/shop/orders?page=${p}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) {
        const items = Array.isArray(data.items) ? data.items : [];
        setOrders((prev) => append ? [...prev, ...items] : items);
        setTotalPages(data.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => { fetchOrders(1); }, []);

  return (
    <CustomerShellClient
      session={session}
      title="구매 내역"
      backHref={`/${orgSlug}/customer/shop`}
    >
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-base font-bold text-muted-foreground">구매 내역이 없습니다</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            상품몰에서 상품권을 구매해보세요
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = STATUS_MAP[order.status] ?? {
              label: order.status,
              color: "text-muted-foreground",
              icon: Clock,
            };
            const StatusIcon = statusInfo.icon;
            const isExpanded = expandedId === order.id;

            return (
              <button
                key={order.id}
                type="button"
                onClick={() =>
                  order.status === "COMPLETED"
                    ? setExpandedId(isExpanded ? null : order.id)
                    : undefined
                }
                className={`w-full text-left bg-card border border-border rounded-2xl p-4 transition-all ${
                  order.status === "COMPLETED"
                    ? "hover:border-primary/30 hover:shadow-sm cursor-pointer"
                    : "cursor-default"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold mb-1">
                      {order.productBrand}
                    </p>
                    <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">
                      {order.productName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(order.createdAt)}
                    </p>
                    {order.status === "REFUNDED" && order.refundedAt && (
                      <p className="text-xs text-blue-400 mt-0.5">
                        환불일 {formatDate(order.refundedAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {order.status === "REFUNDED" ? (
                      <span className="text-sm font-black text-blue-500">환불</span>
                    ) : (
                      <span className="text-sm font-black text-primary">
                        -{formatPoint(order.pointsSpent)}P
                      </span>
                    )}
                    <div className={`flex items-center gap-1 ${statusInfo.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{statusInfo.label}</span>
                    </div>
                  </div>
                </div>

                {/* 핀번호 펼침 */}
                {isExpanded && order.pinNumber && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground font-semibold mb-1">핀번호</p>
                    <p className="text-base font-black text-foreground tracking-widest">
                      {order.pinNumber}
                    </p>
                    {order.pinUrl && (
                      <a
                        href={order.pinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary font-bold underline mt-1 block"
                      >
                        바로 사용하기
                      </a>
                    )}
                    {order.expiresAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        유효기간 ~{formatDate(order.expiresAt)}
                      </p>
                    )}
                  </div>
                )}

                {order.status === "COMPLETED" && !isExpanded && (
                  <p className="text-xs text-primary font-semibold mt-2">
                    탭하여 핀번호 확인
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 더 보기 */}
      {page < totalPages && (
        <button
          type="button"
          onClick={() => {
            const next = page + 1;
            setPage(next);
            fetchOrders(next, true);
          }}
          disabled={loadingMore}
          className="w-full mt-4 py-3 rounded-2xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
        >
          {loadingMore ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </CustomerShellClient>
  );
}
