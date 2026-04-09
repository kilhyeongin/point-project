"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatUsername } from "@/lib/utils";
import { usePathname } from "next/navigation";

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

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function roleLabel(role?: string) {
  if (role === "PARTNER") return "제휴사";
  if (role === "CUSTOMER") return "고객";
  if (role === "ADMIN") return "총괄관리자";
  return role || "-";
}

function statusLabel(status?: string) {
  if (status === "PENDING") return "대기";
  if (status === "APPROVED") return "승인완료";
  if (status === "REJECTED") return "거절";
  return status || "-";
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

export default function Page() {
  const pathname = usePathname();
  const orgSlug = pathname.split('/')[1];

  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => items.filter((it) => it.status === "PENDING").length,
    [items]
  );

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/topup-requests");
      const data = await res.json();

      if (!res.ok) {
        setItems([]);
        setMsg(data?.message ?? "목록 조회 실패");
        return;
      }

      setItems(data.items || []);
    } catch {
      setItems([]);
      setMsg("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setMsg("");
    setWorkingId(id);

    try {
      const res = await fetch(`/api/admin/topup-requests/${id}/approve`, {
        method: "PATCH",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMsg(data?.message ?? "승인 실패");
        return;
      }

      setMsg("✅ 충전 요청을 승인했습니다.");
      await load();
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setWorkingId(null);
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
            <h1 className="text-xl font-black text-foreground tracking-tight">포인트 충전 승인</h1>
            <div className="mt-2 text-muted-foreground text-sm leading-relaxed">
              제휴사의 충전 요청을 승인하면 해당 계정 잔액에 즉시 반영됩니다.
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={load} type="button">
              새로고침
            </Button>
            <a
              href={`/${orgSlug}/admin`}
              className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl border border-border bg-card text-foreground font-bold text-sm hover:bg-muted transition-colors"
            >
              대시보드로
            </a>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">{formatNumber(items.length)}건</div>
          <div className="text-xs text-muted-foreground mt-1">전체 요청</div>
          <div className="text-xs text-muted-foreground">현재 조회된 충전 요청</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">{formatNumber(pendingCount)}건</div>
          <div className="text-xs text-muted-foreground mt-1">승인 대기</div>
          <div className="text-xs text-muted-foreground">처리가 필요한 요청 수</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">{loading ? "조회중" : "완료"}</div>
          <div className="text-xs text-muted-foreground mt-1">로딩 상태</div>
          <div className="text-xs text-muted-foreground">목록 동기화 상태</div>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
          {msg}
        </div>
      )}

      <section className="space-y-3">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            충전 요청이 없습니다.
          </div>
        ) : (
          items.map((it) => (
            <article
              key={it.id}
              className="bg-card shadow-card rounded-2xl p-5 space-y-4"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-base font-black text-foreground">
                    {it.account?.name ?? "-"} ({it.account ? formatUsername(it.account.username) : "-"})
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    대상 역할: {roleLabel(it.account?.role)}
                  </div>
                </div>
                <div className="text-2xl font-black text-foreground whitespace-nowrap tracking-tight">
                  {formatNumber(it.amount)}P
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border rounded-xl p-3 bg-muted/50">
                  <div className="text-xs text-muted-foreground">상태</div>
                  <div className="mt-1 text-sm font-bold leading-snug">
                    <StatusBadge status={it.status} />
                  </div>
                </div>
                <div className="border border-border rounded-xl p-3 bg-muted/50">
                  <div className="text-xs text-muted-foreground">요청일</div>
                  <div className="mt-1 text-sm font-bold leading-snug break-words">
                    {it.createdAt ? new Date(it.createdAt).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="border border-border rounded-xl p-3 bg-muted/50">
                  <div className="text-xs text-muted-foreground">요청자</div>
                  <div className="mt-1 text-sm font-bold leading-snug break-words">
                    {it.requestedBy
                      ? `${it.requestedBy.name} (${formatUsername(it.requestedBy.username)})`
                      : "-"}
                  </div>
                </div>
                <div className="border border-border rounded-xl p-3 bg-muted/50">
                  <div className="text-xs text-muted-foreground">승인자 / 처리일</div>
                  <div className="mt-1 text-sm font-bold leading-snug break-words">
                    {it.approvedBy
                      ? `${it.approvedBy.name} (${formatUsername(it.approvedBy.username)})`
                      : "-"}
                    <br />
                    {it.decidedAt ? new Date(it.decidedAt).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="border border-border rounded-xl p-3 bg-muted/50 col-span-2">
                  <div className="text-xs text-muted-foreground">메모</div>
                  <div className="mt-1 text-sm font-bold leading-snug break-words">
                    {it.note || "-"}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center gap-2 flex-wrap">
                <StatusBadge status={it.status} />
                {it.status === "PENDING" ? (
                  <Button
                    onClick={() => approve(it.id)}
                    type="button"
                    disabled={workingId === it.id}
                  >
                    {workingId === it.id ? "처리 중..." : "승인"}
                  </Button>
                ) : (
                  <Button variant="outline" type="button" disabled>
                    처리 완료
                  </Button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
