"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PreviewItem = {
  counterpartyId: string | null;
  counterparty: {
    id: string;
    username: string;
    name: string;
    role: string;
    status: string;
  } | null;
  useCount: number;
  usedPoints: number;
  lastUsedAt: string | null;
};

type PeriodItem = {
  periodKey: string;
  from: string;
  to: string;
  status: "OPEN" | "CLOSED" | "PAID";
  closedAt?: string | null;
  totalCounterparties: number;
  totalUseCount: number;
  totalUsedPoints: number;
};

type LineItem = {
  id: string;
  periodKey: string;
  status: "OPEN" | "PAID";
  useCount: number;
  usedPoints: number;
  netPayable: number;
  paidAt?: string | null;
  payoutRef?: string;
  note?: string;
  counterparty: {
    id: string;
    username: string;
    name: string;
    role: string;
    status: string;
  } | null;
};

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfThisMonthYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function rangeLastMonth() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 0);

  const yyyy1 = start.getFullYear();
  const mm1 = String(start.getMonth() + 1).padStart(2, "0");
  const dd1 = String(start.getDate()).padStart(2, "0");

  const yyyy2 = end.getFullYear();
  const mm2 = String(end.getMonth() + 1).padStart(2, "0");
  const dd2 = String(end.getDate()).padStart(2, "0");

  return { from: `${yyyy1}-${mm1}-${dd1}`, to: `${yyyy2}-${mm2}-${dd2}` };
}

function periodKeyFromFrom(from: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) return from.slice(0, 7);
  return "";
}

function roleLabel(role?: string) {
  if (role === "PARTNER") return "제휴사";
  if (role === "CUSTOMER") return "고객";
  if (role === "ADMIN") return "총괄관리자";
  return role || "-";
}

function userStatusLabel(status?: string) {
  if (status === "ACTIVE") return "정상";
  if (status === "PENDING") return "대기";
  if (status === "BLOCKED") return "차단";
  return status || "-";
}

function settlementStatusLabel(status?: string) {
  if (status === "PAID") return "지급완료";
  if (status === "CLOSED") return "마감";
  if (status === "OPEN") return "정산대기";
  return status || "-";
}

function SettlementStatusBadge({ status }: { status: string }) {
  if (status === "PAID")
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-extrabold">
        {settlementStatusLabel(status)}
      </Badge>
    );
  if (status === "CLOSED")
    return (
      <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-xs font-extrabold">
        {settlementStatusLabel(status)}
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground border border-border rounded-full text-xs font-extrabold">
      {settlementStatusLabel(status)}
    </Badge>
  );
}

export default function AdminSettlementsPage() {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(firstDayOfThisMonthYYYYMMDD());
  const [to, setTo] = useState(todayYYYYMMDD());

  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const queryKey = useMemo(() => `${q.trim()}|${from}|${to}`, [q, from, to]);

  function setThisMonth() {
    setFrom(firstDayOfThisMonthYYYYMMDD());
    setTo(todayYYYYMMDD());
  }

  function setLastMonth() {
    const r = rangeLastMonth();
    setFrom(r.from);
    setTo(r.to);
  }

  async function loadPreview() {
    setLoading(true);
    setMsg("");

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/admin/settlements?${params.toString()}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        setMsg(data?.message ?? "정산 미리보기 조회 실패");
        setPreview([]);
        return;
      }

      setPreview(data?.items ?? []);
    } catch {
      setMsg("네트워크 오류");
      setPreview([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => loadPreview(), 250);
    return () => clearTimeout(t);
  }, [queryKey]);

  const excelUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/admin/settlements/excel?${params.toString()}`;
  }, [q, from, to]);

  const [closeMsg, setCloseMsg] = useState<string>("");

  async function closePeriod() {
    setCloseMsg("");
    const periodKey = periodKeyFromFrom(from);

    if (!periodKey) {
      setCloseMsg("from 날짜 형식을 확인해주세요. (YYYY-MM-DD)");
      return;
    }

    try {
      const res = await fetch("/api/admin/settlements/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodKey, from, to }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        setCloseMsg(data?.message ?? "마감 실패");
        return;
      }

      setCloseMsg(
        `✅ 마감 완료: ${periodKey} / 업체 ${formatNumber(
          data.totalCounterparties
        )} / 건수 ${formatNumber(data.totalUseCount)} / 사용포인트 ${formatNumber(
          data.totalUsedPoints
        )}P`
      );

      await loadPeriods();
      setSelectedPeriodKey(periodKey);
      await loadLines(periodKey);
    } catch {
      setCloseMsg("네트워크 오류");
    }
  }

  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodErr, setPeriodErr] = useState("");

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesErr, setLinesErr] = useState("");

  async function loadPeriods() {
    setPeriodLoading(true);
    setPeriodErr("");
    try {
      const res = await fetch("/api/admin/settlements/periods");
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        setPeriodErr(data?.message ?? "기간 조회 실패");
        setPeriods([]);
        return;
      }

      setPeriods(data?.items ?? []);
    } catch {
      setPeriodErr("네트워크 오류");
      setPeriods([]);
    } finally {
      setPeriodLoading(false);
    }
  }

  async function loadLines(periodKey: string) {
    setLinesLoading(true);
    setLinesErr("");
    try {
      const res = await fetch(
        `/api/admin/settlements/lines?periodKey=${encodeURIComponent(periodKey)}`
      );
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        setLinesErr(data?.message ?? "라인 조회 실패");
        setLines([]);
        return;
      }

      setLines(data?.items ?? []);
    } catch {
      setLinesErr("네트워크 오류");
      setLines([]);
    } finally {
      setLinesLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (!selectedPeriodKey) return;
    loadLines(selectedPeriodKey);
  }, [selectedPeriodKey]);

  async function markPaid(line: LineItem) {
    if (!selectedPeriodKey || !line.counterparty?.id) return;

    const payoutRef = prompt("지급 참조(거래번호/송금ID) 입력 (선택)") ?? "";
    const note = prompt("메모(선택)") ?? "";

    try {
      const res = await fetch("/api/admin/settlements/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodKey: selectedPeriodKey,
          counterpartyId: line.counterparty.id,
          payoutRef,
          note,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        alert(data?.message ?? "지급 처리 실패");
        return;
      }

      await loadPeriods();
      await loadLines(selectedPeriodKey);
      alert(`✅ 지급 처리 완료 (기간 상태: ${settlementStatusLabel(data.periodStatus)})`);
    } catch {
      alert("네트워크 오류");
    }
  }

  async function cancelPaid(line: LineItem) {
    if (!selectedPeriodKey || !line.counterparty?.id) return;

    const ok = window.confirm("지급완료를 취소하시겠습니까?");
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/settlements/payout-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodKey: selectedPeriodKey,
          counterpartyId: line.counterparty.id,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        alert(data?.message ?? "지급 취소 실패");
        return;
      }

      await loadPeriods();
      await loadLines(selectedPeriodKey);
      alert("✅ 지급 취소 완료");
    } catch {
      alert("네트워크 오류");
    }
  }

  const previewTotals = useMemo(() => {
    const totalCounterparties = preview.length;
    const totalUseCount = preview.reduce(
      (sum, item) => sum + Number(item.useCount || 0),
      0
    );
    const totalUsedPoints = preview.reduce(
      (sum, item) => sum + Number(item.usedPoints || 0),
      0
    );
    const totalNetPayable = totalUsedPoints;

    return {
      totalCounterparties,
      totalUseCount,
      totalUsedPoints,
      totalNetPayable,
    };
  }, [preview]);

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.periodKey === selectedPeriodKey) || null,
    [periods, selectedPeriodKey]
  );

  return (
    <main className="space-y-5">
      {/* 헤더 */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">월 정산 관리</h1>
            <div className="mt-2 text-muted-foreground text-sm leading-relaxed">
              1) 정산 미리보기 조회 → 2) 정산 마감 → 3) 업체별 지급완료 처리
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href={excelUrl}
              className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl border border-foreground bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity"
            >
              미리보기 엑셀
            </a>
            <a
              href={
                selectedPeriodKey
                  ? `/api/admin/settlements/excel-closed?periodKey=${selectedPeriodKey}`
                  : "#"
              }
              className={cn(
                "inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl border border-foreground bg-foreground text-background font-bold text-sm transition-opacity",
                selectedPeriodKey ? "hover:opacity-90" : "opacity-50 pointer-events-none"
              )}
            >
              정산 엑셀
            </a>
          </div>
        </div>
      </section>

      {/* 필터 */}
      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[auto_auto_1fr_auto_auto] gap-3 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-extrabold text-muted-foreground">기간 빠른 선택</span>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={setThisMonth} type="button" className="h-10">
                이번달
              </Button>
              <Button variant="outline" onClick={setLastMonth} type="button" className="h-10">
                지난달
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-extrabold text-muted-foreground">기간 입력</span>
            <div className="flex gap-2">
              <Input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="h-10 w-36"
              />
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="h-10 w-36"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-extrabold text-muted-foreground">업체 검색</label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="상대방 검색 (아이디/이름)"
              className="h-10"
            />
          </div>
          <Button variant="outline" onClick={loadPreview} type="button" className="h-10 self-end">
            새로고침
          </Button>
          <Button onClick={closePeriod} type="button" className="h-10 self-end">
            정산 마감
          </Button>
        </div>
      </section>

      {msg && (
        <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
          {msg}
        </div>
      )}
      {closeMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          {closeMsg}
        </div>
      )}

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-foreground text-background rounded-xl p-4 text-center">
          <div className="text-2xl font-black">
            {formatNumber(previewTotals.totalCounterparties)}
          </div>
          <div className="text-xs opacity-80 mt-1">업체 수</div>
          <div className="text-xs opacity-70">현재 미리보기 정산 대상 수</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">
            {formatNumber(previewTotals.totalUseCount)}건
          </div>
          <div className="text-xs text-muted-foreground mt-1">사용 건수</div>
          <div className="text-xs text-muted-foreground">기간 내 사용 건수</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">
            {formatNumber(previewTotals.totalUsedPoints)}P
          </div>
          <div className="text-xs text-muted-foreground mt-1">사용 포인트</div>
          <div className="text-xs text-muted-foreground">기간 내 사용 포인트 합계</div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">
            {formatNumber(previewTotals.totalNetPayable)}P
          </div>
          <div className="text-xs text-muted-foreground mt-1">예상 지급액</div>
          <div className="text-xs text-muted-foreground">지급 예정 합계</div>
        </div>
      </div>

      {/* 정산 미리보기 */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h2 className="text-base font-black text-foreground">정산 미리보기</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              {loading ? "불러오는 중..." : `미리보기 ${preview.length}건`}
            </div>
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
          ) : preview.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              집계 내역이 없습니다.
            </div>
          ) : (
            <>
              {/* 데스크탑 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[260px_110px_140px_110px_140px_1fr] gap-2 px-4 py-2 text-xs font-bold text-muted-foreground border-b border-border bg-muted/30">
                    <div>상대방(업체)</div>
                    <div>역할</div>
                    <div className="text-right font-bold">사용포인트</div>
                    <div className="text-right font-bold">건수</div>
                    <div className="text-right font-bold">예상 지급액</div>
                    <div>마지막 사용일시</div>
                  </div>

                  {preview.map((it, idx) => {
                    const previewNetPayable = Number(it.usedPoints || 0);

                    return (
                      <div
                        key={`${it.counterpartyId ?? "null"}-${idx}`}
                        className="grid grid-cols-[260px_110px_140px_110px_140px_1fr] gap-2 px-4 py-3 border-b border-border last:border-0 text-sm items-center"
                      >
                        <div>
                          <div className="font-black text-foreground">
                            {it.counterparty
                              ? `${it.counterparty.name} (${it.counterparty.username})`
                              : "-"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {userStatusLabel(it.counterparty?.status)}
                          </div>
                        </div>
                        <div>{it.counterparty ? roleLabel(it.counterparty.role) : "-"}</div>
                        <div className="text-right font-black">{formatNumber(it.usedPoints)}P</div>
                        <div className="text-right font-black">{formatNumber(it.useCount)}건</div>
                        <div className="text-right font-black">{formatNumber(previewNetPayable)}P</div>
                        <div>
                          {it.lastUsedAt ? new Date(it.lastUsedAt).toLocaleString() : "-"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 모바일 카드 */}
              <div className="flex md:hidden flex-col gap-3 p-4">
                {preview.map((it, idx) => {
                  const previewNetPayable = Number(it.usedPoints || 0);

                  return (
                    <article
                      key={`${it.counterpartyId ?? "null"}-${idx}`}
                      className="border border-border rounded-2xl p-4 bg-muted/20"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="text-sm font-black text-foreground">
                            {it.counterparty
                              ? `${it.counterparty.name} (${it.counterparty.username})`
                              : "-"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            역할: {it.counterparty ? roleLabel(it.counterparty.role) : "-"}
                            <br />
                            상태: {userStatusLabel(it.counterparty?.status)}
                          </div>
                        </div>
                        <div className="text-xl font-black text-foreground whitespace-nowrap">
                          {formatNumber(previewNetPayable)}P
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground w-24 shrink-0">사용포인트</span>
                          <span className="text-right">{formatNumber(it.usedPoints)}P</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground w-24 shrink-0">건수</span>
                          <span className="text-right">{formatNumber(it.useCount)}건</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground w-24 shrink-0">마지막 사용일시</span>
                          <span className="text-right break-words">
                            {it.lastUsedAt ? new Date(it.lastUsedAt).toLocaleString() : "-"}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 마감된 정산 조회 / 지급 처리 */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex justify-between items-start gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-base font-black text-foreground">마감된 정산 조회 / 지급 처리</h2>
            <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
              마감된 기간을 선택하면 업체별 지급액을 확인하고 지급완료 처리할 수 있습니다.
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" onClick={loadPeriods} type="button" className="h-10">
              기간 새로고침
            </Button>
            <select
              value={selectedPeriodKey}
              onChange={(e) => setSelectedPeriodKey(e.target.value)}
              className="h-10 min-w-[180px] border border-border rounded-xl bg-background px-3 text-sm outline-none"
            >
              <option value="">기간 선택</option>
              {periods.map((p) => (
                <option key={p.periodKey} value={p.periodKey}>
                  {p.periodKey} ({settlementStatusLabel(p.status)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {periodErr && (
          <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold mb-3">
            {periodErr}
          </div>
        )}

        <div className="text-sm text-muted-foreground mb-3">
          {periodLoading ? "불러오는 중..." : `기간 ${periods.length}개`}
        </div>

        {periods.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {periods.map((p) => (
              <button
                key={p.periodKey}
                type="button"
                onClick={() => setSelectedPeriodKey(p.periodKey)}
                className={cn(
                  "border rounded-2xl p-4 text-left transition-colors",
                  selectedPeriodKey === p.periodKey
                    ? "border-foreground bg-card shadow-sm"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="text-base font-black text-foreground">{p.periodKey}</div>
                  <SettlementStatusBadge status={p.status} />
                </div>
                <div className="mt-3 space-y-1 text-sm text-foreground">
                  <div>업체 {formatNumber(p.totalCounterparties)}개</div>
                  <div>건수 {formatNumber(p.totalUseCount)}건</div>
                  <div>사용포인트 {formatNumber(p.totalUsedPoints)}P</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedPeriod && (
          <div className="mt-3 p-3 rounded-xl border border-border bg-muted/30 flex gap-3 flex-wrap items-center text-sm">
            <div>
              기간: <b>{selectedPeriod.periodKey}</b>
            </div>
            <div>업체 {formatNumber(selectedPeriod.totalCounterparties)}개</div>
            <div>건수 {formatNumber(selectedPeriod.totalUseCount)}건</div>
            <div>사용포인트 {formatNumber(selectedPeriod.totalUsedPoints)}P</div>
            <div>상태: {settlementStatusLabel(selectedPeriod.status)}</div>
          </div>
        )}

        {linesErr && (
          <div className="mt-3 p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
            {linesErr}
          </div>
        )}

        <div className="mt-3 text-sm text-muted-foreground">
          {linesLoading
            ? "불러오는 중..."
            : selectedPeriodKey
            ? `라인 ${lines.length}개`
            : "기간을 선택하세요"}
        </div>

        {selectedPeriodKey && (
          <div className="mt-3 border border-border rounded-xl overflow-hidden">
            {linesLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : lines.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                라인이 없습니다.
              </div>
            ) : (
              <>
                {/* 데스크탑 테이블 */}
                <div className="hidden md:block overflow-x-auto">
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-[260px_100px_140px_140px_120px_1fr] gap-2 px-4 py-2 text-xs font-bold text-muted-foreground border-b border-border bg-muted/30">
                      <div>업체</div>
                      <div>상태</div>
                      <div className="text-right">사용포인트</div>
                      <div className="text-right">지급액</div>
                      <div className="text-right">건수</div>
                      <div className="text-right">처리</div>
                    </div>

                    {lines.map((l) => (
                      <div
                        key={l.id}
                        className="grid grid-cols-[260px_100px_140px_140px_120px_1fr] gap-2 px-4 py-3 border-b border-border last:border-0 text-sm items-center"
                      >
                        <div>
                          <div className="font-black text-foreground">
                            {l.counterparty
                              ? `${l.counterparty.name} (${l.counterparty.username})`
                              : "-"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {l.counterparty ? roleLabel(l.counterparty.role) : "-"}
                          </div>
                        </div>
                        <div>
                          <SettlementStatusBadge status={l.status} />
                        </div>
                        <div className="text-right font-black">{formatNumber(l.usedPoints)}P</div>
                        <div className="text-right font-black">{formatNumber(l.netPayable)}P</div>
                        <div className="text-right font-black">{formatNumber(l.useCount)}건</div>
                        <div className="flex justify-end gap-2 flex-wrap">
                          <a
                            href={
                              l.counterparty?.id
                                ? `/admin/settlements/print?periodKey=${selectedPeriodKey}&counterpartyId=${l.counterparty.id}`
                                : "#"
                            }
                            target="_blank"
                            className={cn(
                              "inline-flex items-center justify-center h-8 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-bold hover:bg-muted transition-colors",
                              !l.counterparty?.id && "opacity-50 pointer-events-none"
                            )}
                          >
                            정산서
                          </a>
                          <button
                            disabled={l.status === "PAID"}
                            onClick={() => markPaid(l)}
                            type="button"
                            className={cn(
                              "inline-flex items-center justify-center h-8 px-3 rounded-lg border border-foreground bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity",
                              l.status === "PAID" && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            지급완료
                          </button>
                          {l.status === "PAID" && (
                            <button
                              onClick={() => cancelPaid(l)}
                              type="button"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-red-300 text-red-600 bg-card text-xs font-bold hover:bg-red-50 transition-colors"
                            >
                              지급취소
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 모바일 카드 */}
                <div className="flex md:hidden flex-col gap-3 p-4">
                  {lines.map((l) => (
                    <article key={l.id} className="border border-border rounded-2xl p-4 bg-muted/20">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="text-sm font-black text-foreground">
                            {l.counterparty
                              ? `${l.counterparty.name} (${l.counterparty.username})`
                              : "-"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            역할: {l.counterparty ? roleLabel(l.counterparty.role) : "-"}
                            <br />
                            상태: {settlementStatusLabel(l.status)}
                          </div>
                        </div>
                        <div className="text-xl font-black text-foreground whitespace-nowrap">
                          {formatNumber(l.netPayable)}P
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground w-20 shrink-0">사용포인트</span>
                          <span className="text-right">{formatNumber(l.usedPoints)}P</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground w-20 shrink-0">지급액</span>
                          <span className="text-right">{formatNumber(l.netPayable)}P</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground w-20 shrink-0">건수</span>
                          <span className="text-right">{formatNumber(l.useCount)}건</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground w-20 shrink-0">지급참조</span>
                          <span className="text-right break-words">{l.payoutRef || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground w-20 shrink-0">메모</span>
                          <span className="text-right break-words">{l.note || "-"}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <a
                          href={
                            l.counterparty?.id
                              ? `/admin/settlements/print?periodKey=${selectedPeriodKey}&counterpartyId=${l.counterparty.id}`
                              : "#"
                          }
                          target="_blank"
                          className={cn(
                            "inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl border border-border bg-card text-foreground font-bold text-sm hover:bg-muted transition-colors",
                            !l.counterparty?.id && "opacity-50 pointer-events-none"
                          )}
                        >
                          정산서
                        </a>
                        <button
                          disabled={l.status === "PAID"}
                          onClick={() => markPaid(l)}
                          type="button"
                          className={cn(
                            "inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl border border-foreground bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity",
                            l.status === "PAID" && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          지급완료
                        </button>
                        {l.status === "PAID" && (
                          <button
                            onClick={() => cancelPaid(l)}
                            type="button"
                            className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl border border-red-300 text-red-600 bg-card font-bold text-sm hover:bg-red-50 transition-colors"
                          >
                            지급취소
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
