"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type UserBrief = {
  id: string;
  username: string;
  name: string;
  role: string;
} | null;

type LedgerItem = {
  id: string;
  type: "TOPUP" | "ISSUE" | "USE" | "ADJUST";
  amount: number;
  note?: string;
  createdAt: string;
  refType?: string | null;
  refId?: string | null;
  account: UserBrief;
  user: UserBrief;
  actor: UserBrief;
};

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function typeLabel(type: string) {
  if (type === "TOPUP") return "충전";
  if (type === "ISSUE") return "지급";
  if (type === "USE") return "사용";
  if (type === "ADJUST") return "조정";
  return type;
}

function roleLabel(role?: string) {
  if (role === "CUSTOMER") return "고객";
  if (role === "PARTNER") return "제휴사";
  if (role === "ADMIN") return "총괄관리자";
  return role || "-";
}

function renderUser(user: UserBrief) {
  if (!user) return "-";
  return user.name || "-";
}

function renderUserWithRole(user: UserBrief) {
  if (!user) return "-";
  return `${user.name} / ${roleLabel(user.role)}`;
}

function amountText(amount: number) {
  if (amount > 0) return `+${formatNumber(amount)}P`;
  if (amount < 0) return `-${formatNumber(Math.abs(amount))}P`;
  return "0P";
}

const TYPE_CHIPS = ["ALL", "TOPUP", "ISSUE", "USE"];

export default function AdminLedgerPage() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);

  const stats = useMemo(() => {
    const topup = items.filter((it) => it.type === "TOPUP").length;
    const issue = items.filter((it) => it.type === "ISSUE").length;
    const use = items.filter((it) => it.type === "USE").length;
    const adjust = items.filter((it) => it.type === "ADJUST").length;

    const positiveAmount = items
      .filter((it) => it.amount > 0)
      .reduce((sum, it) => sum + Number(it.amount || 0), 0);

    const negativeAmount = items
      .filter((it) => it.amount < 0)
      .reduce((sum, it) => sum + Math.abs(Number(it.amount || 0)), 0);

    return {
      total,
      topup,
      issue,
      use,
      adjust,
      positiveAmount,
      negativeAmount,
    };
  }, [items, total]);

  async function load(p = page) {
    setLoading(true);
    setMsg("");
    setSearched(true);

    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (type !== "ALL") sp.set("type", type);
    if (start) sp.set("start", start);
    if (end) sp.set("end", end);
    sp.set("page", String(p));

    try {
      const res = await fetch(`/api/admin/ledger?${sp.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMsg(data?.message ?? "내역 조회 실패");
        setItems([]);
        return;
      }

      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
      setPage(p);
    } catch {
      setMsg("네트워크 오류");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setQ(""); setType("ALL"); setStart(""); setEnd("");
    setItems([]); setTotal(0); setTotalPages(1); setPage(1); setSearched(false); setMsg("");
  }

  return (
    <main className="space-y-5">
      <section className="bg-card shadow-card rounded-2xl p-5">
        <h1 className="text-xl font-black text-foreground tracking-tight">전체 내역</h1>
        <p className="mt-1 text-sm text-muted-foreground">모든 포인트 거래 내역을 조회합니다.</p>
      </section>

      <section className="bg-card shadow-card rounded-2xl p-5 space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="이름 검색"
            className="h-10 flex-1 min-w-[160px]"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 min-w-[120px] border border-border rounded-xl bg-background px-3 text-sm outline-none"
          >
            <option value="ALL">전체 유형</option>
            <option value="TOPUP">충전</option>
            <option value="ISSUE">지급</option>
            <option value="USE">사용</option>
          </select>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-10 border border-border rounded-xl bg-background px-3 text-sm outline-none"
          />
          <span className="text-muted-foreground text-sm">~</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="h-10 border border-border rounded-xl bg-background px-3 text-sm outline-none"
          />
          <Button onClick={() => load(1)} type="button" className="text-sm font-bold">
            조회
          </Button>
          <Button onClick={handleReset} variant="outline" type="button" className="text-xs">
            초기화
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {TYPE_CHIPS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "min-h-[36px] px-3 rounded-xl border text-sm font-bold transition-colors",
                type === t
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-muted"
              )}
            >
              {t === "ALL" ? "전체" : typeLabel(t)}
            </button>
          ))}
        </div>
      </section>

      {!searched && (
        <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          필터를 입력하고 조회 버튼을 눌러주세요.
        </div>
      )}

      {searched && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-foreground text-background rounded-xl p-4 text-center">
          <div className="text-2xl font-black">{formatNumber(stats.total)}건</div>
          <div className="text-xs opacity-80 mt-1">조회 건수</div>
          <div className="text-xs opacity-70 mt-0.5">
            충전 {formatNumber(stats.topup)} / 지급 {formatNumber(stats.issue)} / 사용{" "}
            {formatNumber(stats.use)} / 조정 {formatNumber(stats.adjust)}
          </div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-emerald-600">
            +{formatNumber(stats.positiveAmount)}P
          </div>
          <div className="text-xs text-muted-foreground mt-1">총 지급·충전</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-red-500">
            -{formatNumber(stats.negativeAmount)}P
          </div>
          <div className="text-xs text-muted-foreground mt-1">총 사용·차감</div>
        </div>
      </div>}

      {searched && msg && (
        <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
          {msg}
        </div>
      )}

      {searched && <section className="bg-card shadow-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            조회된 내역이 없습니다.
          </div>
        ) : (
          <>
            {/* 데스크탑 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <div className="min-w-[1300px]">
                <div className="grid grid-cols-[90px_110px_170px_170px_170px_150px_minmax(180px,1fr)] gap-x-3 px-5 py-2.5 text-xs font-bold text-muted-foreground border-b border-border bg-muted/30">
                  <div>유형</div>
                  <div>금액</div>
                  <div>지갑 주인</div>
                  <div>직접 대상</div>
                  <div>실행자</div>
                  <div>생성시각</div>
                  <div>메모</div>
                </div>

                {items.map((it) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-[90px_110px_170px_170px_170px_150px_minmax(180px,1fr)] gap-x-3 px-5 py-3.5 border-b border-border last:border-0 text-sm items-start"
                  >
                    <div className="pt-0.5">
                      <Badge className={cn(
                        "rounded-full text-xs font-bold border",
                        it.type === "TOPUP" && "bg-blue-50 text-blue-700 border-blue-200",
                        it.type === "ISSUE" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        it.type === "USE" && "bg-orange-50 text-orange-700 border-orange-200",
                        it.type === "ADJUST" && "bg-purple-50 text-purple-700 border-purple-200",
                      )}>
                        {typeLabel(it.type)}
                      </Badge>
                    </div>
                    <div className={cn(
                      "font-bold pt-0.5",
                      it.amount < 0 ? "text-red-600" : it.amount > 0 ? "text-emerald-600" : "text-foreground"
                    )}>
                      {amountText(it.amount)}
                    </div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
                      {renderUserWithRole(it.account)}
                    </div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
                      {renderUserWithRole(it.user)}
                    </div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
                      {renderUserWithRole(it.actor)}
                    </div>
                    <div className="text-muted-foreground whitespace-nowrap">
                      {it.createdAt ? new Date(it.createdAt).toLocaleString() : "-"}
                    </div>
                    <div className="text-foreground break-words leading-relaxed">
                      {it.note || "-"}
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
                      <div className="flex gap-2 flex-wrap items-center mb-2">
                        <Badge className="bg-muted text-muted-foreground border border-border rounded-full text-xs font-black">
                          {typeLabel(it.type)}
                        </Badge>
                      </div>
                      <div className="text-sm font-black text-foreground">
                        {renderUser(it.account)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        지갑 주인 역할: {it.account ? roleLabel(it.account.role) : "-"}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-xl font-black whitespace-nowrap",
                        it.amount < 0 ? "text-red-600" : "text-foreground"
                      )}
                    >
                      {amountText(it.amount)}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground shrink-0 w-20">직접 대상</span>
                      <span className="text-right break-words">{renderUserWithRole(it.user)}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground shrink-0 w-20">실행자</span>
                      <span className="text-right break-words">{renderUserWithRole(it.actor)}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground shrink-0 w-20">메모</span>
                      <span className="text-right break-words">{it.note || "-"}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground shrink-0 w-20">생성시각</span>
                      <span className="text-right break-words">
                        {it.createdAt ? new Date(it.createdAt).toLocaleString() : "-"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>}

      {/* 페이지네이션 */}
      {searched && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            총 {total.toLocaleString()}건 · {page} / {totalPages} 페이지
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => load(Math.max(1, page - 1))}
            >
              이전
            </Button>
            <span className="text-sm font-bold text-foreground px-1">
              {page}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => load(Math.min(totalPages, page + 1))}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
