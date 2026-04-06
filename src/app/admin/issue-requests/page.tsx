"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsername } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Item = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  amount: number;
  note?: string;
  createdAt: string;
  decidedAt?: string | null;
  ledgerId?: string | null;
  requester: {
    id: string;
    username: string;
    name: string;
    role: string;
  } | null;
  customer: {
    id: string;
    username: string;
    name: string;
    role: string;
  } | null;
};

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function statusLabel(status: string) {
  if (status === "APPROVED") return "지급완료";
  if (status === "PENDING") return "대기";
  if (status === "REJECTED") return "거절";
  return status;
}

function roleLabel(role?: string) {
  if (role === "PARTNER") return "제휴사";
  if (role === "CUSTOMER") return "고객";
  if (role === "ADMIN") return "총괄관리자";
  return role || "-";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "APPROVED")
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-extrabold">
        {statusLabel(status)}
      </Badge>
    );
  if (status === "PENDING")
    return (
      <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-xs font-extrabold">
        {statusLabel(status)}
      </Badge>
    );
  if (status === "REJECTED")
    return (
      <Badge className="bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-extrabold">
        {statusLabel(status)}
      </Badge>
    );
  return <Badge>{statusLabel(status)}</Badge>;
}

export default function AdminIssueRequestsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (status !== "ALL") sp.set("status", status);
    return sp.toString();
  }, [q, status]);

  const approvedCount = useMemo(
    () => items.filter((it) => it.status === "APPROVED").length,
    [items]
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.amount || 0), 0),
    [items]
  );

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const url = queryString
        ? `/api/admin/issue-requests?${queryString}`
        : "/api/admin/issue-requests";

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMsg(data?.message ?? "지급 이력 조회 실패");
        setItems([]);
        return;
      }

      setItems(data.items ?? []);
    } catch {
      setMsg("네트워크 오류");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="space-y-5">
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              고객 포인트 지급 이력
            </h1>
            <div className="mt-2 text-muted-foreground text-sm leading-relaxed">
              고객 포인트 지급은 제휴사가 잔액 범위 내에서 즉시 실행합니다.
              이 화면은 관리자 승인 화면이 아니라 조회/감사용 이력 화면입니다.
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={load} type="button">
              조회
            </Button>
            <a
              href="/admin"
              className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl border border-border bg-card text-foreground font-bold text-sm hover:bg-muted transition-colors"
            >
              대시보드로
            </a>
          </div>
        </div>
      </section>

      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="고객 이름 또는 아이디 검색"
            className="h-10 flex-1 min-w-[200px]"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 min-w-[140px] border border-border rounded-xl bg-background px-3 text-sm outline-none"
          >
            <option value="ALL">전체 상태</option>
            <option value="APPROVED">지급완료</option>
            <option value="PENDING">대기</option>
            <option value="REJECTED">거절</option>
          </select>
          <Button onClick={load} type="button">
            조회
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">{formatNumber(items.length)}건</div>
          <div className="text-xs text-muted-foreground mt-1">조회 건수</div>
          <div className="text-xs text-muted-foreground">현재 필터 기준</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">{formatNumber(approvedCount)}건</div>
          <div className="text-xs text-muted-foreground mt-1">지급완료 건수</div>
          <div className="text-xs text-muted-foreground">APPROVED 기준</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">{formatNumber(totalAmount)}P</div>
          <div className="text-xs text-muted-foreground mt-1">조회 합계 포인트</div>
          <div className="text-xs text-muted-foreground">현재 목록 합산</div>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
          {msg}
        </div>
      )}

      <section className="bg-card shadow-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            조회된 지급 이력이 없습니다.
          </div>
        ) : (
          <>
            {/* 데스크탑 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="flex items-center gap-3 py-2 px-4 text-xs font-bold text-muted-foreground border-b border-border bg-muted/30">
                  <div className="w-[180px] shrink-0">지급자</div>
                  <div className="w-[180px] shrink-0">고객</div>
                  <div className="w-[110px] shrink-0 text-right">포인트</div>
                  <div className="w-[100px] shrink-0">상태</div>
                  <div className="flex-1">메모</div>
                  <div className="w-[160px] shrink-0">실행시각</div>
                </div>

                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 py-3 px-4 border-b border-border last:border-0 text-sm">
                    <div className="w-[180px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap">
                      {it.requester
                        ? `${it.requester.name} (${formatUsername(it.requester.username)})`
                        : "-"}
                    </div>
                    <div className="w-[180px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap">
                      {it.customer
                        ? `${it.customer.name} (${formatUsername(it.customer.username)})`
                        : "-"}
                    </div>
                    <div className="w-[110px] shrink-0 text-right font-black">
                      {formatNumber(it.amount)}P
                    </div>
                    <div className="w-[100px] shrink-0">
                      <StatusBadge status={it.status} />
                    </div>
                    <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {it.note || "-"}
                    </div>
                    <div className="w-[160px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap">
                      {it.createdAt ? new Date(it.createdAt).toLocaleString() : "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 모바일 카드 */}
            <div className="flex md:hidden flex-col gap-3 p-4">
              {items.map((it) => (
                <article key={it.id} className="border border-border rounded-2xl p-4 bg-muted/20">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="text-sm font-black text-foreground">
                        {it.customer
                          ? `${it.customer.name} (${formatUsername(it.customer.username)})`
                          : "고객 정보 없음"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        지급자:{" "}
                        {it.requester
                          ? `${it.requester.name} (${formatUsername(it.requester.username)})`
                          : "-"}
                        <br />
                        지급자 역할: {roleLabel(it.requester?.role)}
                      </div>
                    </div>
                    <div className="text-xl font-black text-foreground whitespace-nowrap">
                      {formatNumber(it.amount)}P
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">상태</span>
                      <StatusBadge status={it.status} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">실행시각</span>
                      <span>
                        {it.createdAt
                          ? new Date(it.createdAt).toLocaleString()
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">메모</span>
                      <span>{it.note || "-"}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
