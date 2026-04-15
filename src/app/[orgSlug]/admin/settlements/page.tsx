"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

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
  status: "OPEN" | "PAID";
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
  issuedPoints: number;
  issueCount: number;
  visitorCount: number;
  completedCount: number;
  cancelledCount: number;
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstDayOfThisMonthYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function periodKeyFromFrom(from: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) return from.slice(0, 7);
  return "";
}

function periodLabel(periodKey: string) {
  const [y, m] = periodKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

function SettlementStatusBadge({ status }: { status: string }) {
  if (status === "PAID")
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-extrabold">
        지급완료
      </Badge>
    );
  if (status === "OPEN")
    return (
      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-extrabold">
        마감
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground border border-border rounded-full text-xs font-extrabold">
      정산대기
    </Badge>
  );
}

export default function AdminSettlementsPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  // ── 마감된 정산 (메인) ──────────────────────────────────
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesErr, setLinesErr] = useState("");

  // ── 일괄 처리 ───────────────────────────────────────────
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  // ── 이번달 미정산 현황 (접기/펼치기) ──────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [from, setFrom] = useState(firstDayOfThisMonthYYYYMMDD());
  const [to, setTo] = useState(todayYYYYMMDD());
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMsg, setPreviewMsg] = useState("");
  const [closeMsg, setCloseMsg] = useState("");

  // ── 마감된 정산 로드 ────────────────────────────────────
  async function loadPeriods() {
    setPeriodLoading(true);
    try {
      const res = await fetch("/api/admin/settlements/periods");
      const data = await res.json();
      const items: PeriodItem[] = data?.items ?? [];
      setPeriods(items);
      // 가장 최근 마감 기간 자동 선택
      if (!selectedPeriodKey && items.length > 0) {
        setSelectedPeriodKey(items[0].periodKey);
      }
    } finally {
      setPeriodLoading(false);
    }
  }

  async function loadLines(periodKey: string) {
    setLinesLoading(true);
    setLinesErr("");
    try {
      const res = await fetch(`/api/admin/settlements/lines?periodKey=${encodeURIComponent(periodKey)}`);
      const data = await res.json();
      if (!res.ok) {
        setLinesErr(data?.message ?? "조회 실패");
        setLines([]);
      } else {
        setLines(data?.items ?? []);
      }
    } catch {
      setLinesErr("네트워크 오류");
      setLines([]);
    } finally {
      setLinesLoading(false);
    }
  }

  useEffect(() => { loadPeriods(); }, []);
  useEffect(() => {
    if (selectedPeriodKey) loadLines(selectedPeriodKey);
    setCheckedIds(new Set());
    setBulkMsg("");
  }, [selectedPeriodKey]);

  // ── 미정산 미리보기 로드 ────────────────────────────────
  async function loadPreview() {
    setPreviewLoading(true);
    setPreviewMsg("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/settlements?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) { setPreviewMsg(data?.message ?? "조회 실패"); setPreview([]); }
      else setPreview(data?.items ?? []);
    } catch {
      setPreviewMsg("네트워크 오류");
      setPreview([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (!previewOpen) return;
    const t = setTimeout(loadPreview, 200);
    return () => clearTimeout(t);
  }, [previewOpen, from, to]);

  // ── 정산 마감 ───────────────────────────────────────────
  async function closePeriod() {
    setCloseMsg("");
    const periodKey = periodKeyFromFrom(from);
    if (!periodKey) { setCloseMsg("from 날짜를 확인해주세요."); return; }
    try {
      const res = await fetch("/api/admin/settlements/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodKey, from, to }),
      });
      const data = await res.json();
      if (!res.ok) { setCloseMsg(data?.message ?? "마감 실패"); return; }
      setCloseMsg(`✅ ${periodKey} 마감 완료 — 업체 ${formatNumber(data.totalCounterparties)}개 / ${formatNumber(data.totalUsedPoints)}P`);
      await loadPeriods();
      setSelectedPeriodKey(periodKey);
    } catch {
      setCloseMsg("네트워크 오류");
    }
  }

  // ── 지급완료 / 지급취소 ────────────────────────────────
  async function markPaid(line: LineItem) {
    if (!selectedPeriodKey || !line.counterparty?.id) return;
    const payoutRef = prompt("지급 참조번호 입력 (선택)") ?? "";
    const note = prompt("메모 (선택)") ?? "";
    try {
      const res = await fetch("/api/admin/settlements/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodKey: selectedPeriodKey, counterpartyId: line.counterparty.id, payoutRef, note }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data?.message ?? "지급 처리 실패"); return; }
      await loadPeriods();
      await loadLines(selectedPeriodKey);
    } catch {
      alert("네트워크 오류");
    }
  }

  async function cancelPaid(line: LineItem) {
    if (!selectedPeriodKey || !line.counterparty?.id) return;
    if (!window.confirm("지급완료를 취소하시겠습니까?")) return;
    try {
      const res = await fetch("/api/admin/settlements/payout-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodKey: selectedPeriodKey, counterpartyId: line.counterparty.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data?.message ?? "취소 실패"); return; }
      await loadPeriods();
      await loadLines(selectedPeriodKey);
    } catch {
      alert("네트워크 오류");
    }
  }

  // ── 일괄 지급완료 ───────────────────────────────────────
  async function markPaidBulk() {
    const targets = lines.filter((l) => checkedIds.has(l.id) && l.status !== "PAID" && l.counterparty?.id);
    if (targets.length === 0) return;
    if (!window.confirm(`선택한 ${targets.length}개 업체를 일괄 지급완료 처리하시겠습니까?`)) return;

    setBulkLoading(true);
    setBulkMsg("");
    let successCount = 0;

    for (const l of targets) {
      try {
        const res = await fetch("/api/admin/settlements/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodKey: selectedPeriodKey, counterpartyId: l.counterparty!.id, payoutRef: "", note: "일괄 지급완료" }),
        });
        if (res.ok) successCount++;
      } catch { /* continue */ }
    }

    await loadPeriods();
    await loadLines(selectedPeriodKey);
    setCheckedIds(new Set());
    setBulkMsg(`✅ ${successCount}/${targets.length}개 지급완료 처리됨`);
    setBulkLoading(false);
  }

  // ── 정산서 일괄 다운로드 ────────────────────────────────
  async function downloadAllPdfs() {
    const targets = lines.filter((l) => l.counterparty?.id);
    if (targets.length === 0) return;
    setBulkMsg(`PDF 다운로드 중... (0/${targets.length})`);

    for (let i = 0; i < targets.length; i++) {
      const l = targets[i];
      try {
        const url = `/api/admin/settlements/pdf?periodKey=${encodeURIComponent(selectedPeriodKey)}&counterpartyId=${l.counterparty!.id}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `정산서_${selectedPeriodKey}_${l.counterparty!.name}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        await new Promise((r) => setTimeout(r, 400));
        setBulkMsg(`PDF 다운로드 중... (${i + 1}/${targets.length})`);
      } catch { /* continue */ }
    }

    setBulkMsg(`✅ ${targets.length}개 정산서 다운로드 완료`);
  }

  // ── 파생 값 ────────────────────────────────────────────
  const selectedPeriod = useMemo(
    () => periods.find((p) => p.periodKey === selectedPeriodKey) ?? null,
    [periods, selectedPeriodKey]
  );

  const unpaidCount = useMemo(
    () => lines.filter((l) => l.status !== "PAID").length,
    [lines]
  );

  // 탐색 가능한 전체 월 범위 생성 (가장 오래된 마감 달 ~ 이번달)
  const monthRange = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (periods.length === 0) return [currentKey];

    const oldest = periods[periods.length - 1].periodKey; // periods는 최신순
    const result: string[] = [];
    let [y, m] = oldest.split("-").map(Number);
    const [cy, cm] = currentKey.split("-").map(Number);

    while (y < cy || (y === cy && m <= cm)) {
      result.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return result.reverse(); // 최신순
  }, [periods]);

  const monthRangeIndex = useMemo(
    () => monthRange.findIndex((k) => k === selectedPeriodKey),
    [monthRange, selectedPeriodKey]
  );

  function goPrev() {
    // 최신순 배열 → index+1이 이전 달
    if (monthRangeIndex < monthRange.length - 1)
      setSelectedPeriodKey(monthRange[monthRangeIndex + 1]);
  }

  function goNext() {
    // index-1이 다음 달(더 최근)
    if (monthRangeIndex > 0)
      setSelectedPeriodKey(monthRange[monthRangeIndex - 1]);
  }

  // 미지급 업체 상단 고정
  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => {
      if (a.status === "PAID" && b.status !== "PAID") return 1;
      if (a.status !== "PAID" && b.status === "PAID") return -1;
      return 0;
    }),
    [lines]
  );

  const unpaidLines = useMemo(() => sortedLines.filter((l) => l.status !== "PAID"), [sortedLines]);
  const checkedUnpaid = useMemo(
    () => unpaidLines.filter((l) => checkedIds.has(l.id)),
    [unpaidLines, checkedIds]
  );
  const allUnpaidChecked = unpaidLines.length > 0 && checkedUnpaid.length === unpaidLines.length;

  const linesTotals = useMemo(() => ({
    totalNetPayable: lines.reduce((s, l) => s + l.netPayable, 0),
    totalUsedPoints: lines.reduce((s, l) => s + l.usedPoints, 0),
    paidCount: lines.filter((l) => l.status === "PAID").length,
  }), [lines]);

  const excelClosedUrl = selectedPeriodKey
    ? `/api/admin/settlements/excel-closed?periodKey=${selectedPeriodKey}`
    : "#";

  return (
    <main className="space-y-5">

      {/* ── 헤더 ───────────────────────────────────────── */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">제휴사 관리</h1>
            <p className="mt-1 text-sm text-muted-foreground">매월 1일 자동 마감 · 업체별 지급 처리</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href={excelClosedUrl}
              className={cn(
                "inline-flex items-center justify-center h-9 px-4 rounded-xl border border-foreground bg-foreground text-background font-bold text-sm transition-opacity",
                selectedPeriodKey ? "hover:opacity-90" : "opacity-40 pointer-events-none"
              )}
            >
              엑셀 다운로드
            </a>
            <Button variant="outline" size="sm" onClick={loadPeriods} className="h-9 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              새로고침
            </Button>
          </div>
        </div>
      </section>

      {/* ── 월 네비게이터 ────────────────────────────────── */}
      {periodLoading ? (
        <div className="bg-card shadow-card rounded-2xl py-10 text-center text-sm text-muted-foreground">
          불러오는 중...
        </div>
      ) : periods.length === 0 ? (
        <div className="bg-card shadow-card rounded-2xl py-10 text-center text-sm text-muted-foreground">
          마감된 정산이 없습니다.
        </div>
      ) : selectedPeriodKey ? (
        <div className="bg-card shadow-card rounded-2xl px-6 py-5">
          {/* 월 타이틀 + 화살표 */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={goPrev}
              disabled={monthRangeIndex < 0 || monthRangeIndex >= monthRange.length - 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>

            <h2 className="text-2xl font-black text-foreground tracking-tight">
              {selectedPeriodKey.slice(0, 4)}년 {Number(selectedPeriodKey.slice(5))}월
            </h2>

            <button
              type="button"
              onClick={goNext}
              disabled={monthRangeIndex <= 0}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>

            <SettlementStatusBadge status={selectedPeriod?.status ?? "OPEN"} />
          </div>

          {/* 통계 */}
          <div className="flex items-center gap-5 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground font-semibold mb-0.5">정산 업체</div>
              <div className="text-base font-black text-foreground">
                {selectedPeriod ? selectedPeriod.totalCounterparties : 0}개
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-xs text-muted-foreground font-semibold mb-0.5">사용 포인트</div>
              <div className="text-base font-black text-foreground">
                {selectedPeriod ? formatNumber(selectedPeriod.totalUsedPoints) : 0}P
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-xs text-muted-foreground font-semibold mb-0.5">지급 건수</div>
              <div className="text-base font-black text-foreground">
                {selectedPeriod ? selectedPeriod.totalUseCount : 0}건
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 선택된 월 업체별 정산 리스트 ─────────────────── */}
      {selectedPeriodKey && (
        <section className="bg-card shadow-card rounded-2xl p-5">
          {/* 섹션 헤더 */}
          <div className="flex justify-between items-start gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="text-base font-black text-foreground">
                {periodLabel(selectedPeriodKey)} 업체별 정산
              </h2>
              {selectedPeriod ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  업체 {selectedPeriod.totalCounterparties}개 · 사용 {formatNumber(selectedPeriod.totalUsedPoints)}P
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">아직 마감되지 않은 달입니다.</p>
              )}
            </div>
            <SettlementStatusBadge status={selectedPeriod?.status ?? "OPEN"} />
          </div>

          {/* 요약 통계 */}
          {selectedPeriod && !linesLoading && lines.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-foreground text-background rounded-xl px-4 py-3 text-center">
                <div className="text-xl font-black">{lines.length}개</div>
                <div className="text-xs opacity-75 mt-0.5">전체 업체</div>
              </div>
              <div className="bg-muted/50 rounded-xl px-4 py-3 text-center">
                <div className="text-xl font-black text-foreground">{formatNumber(linesTotals.totalUsedPoints)}P</div>
                <div className="text-xs text-muted-foreground mt-0.5">총 사용 포인트</div>
              </div>
              <div className="bg-muted/50 rounded-xl px-4 py-3 text-center">
                <div className="text-xl font-black text-foreground">{formatNumber(linesTotals.totalNetPayable)}P</div>
                <div className="text-xs text-muted-foreground mt-0.5">총 지급 예정액</div>
              </div>
              <div className={cn(
                "rounded-xl px-4 py-3 text-center",
                unpaidCount === 0 ? "bg-emerald-50" : "bg-amber-50"
              )}>
                <div className={cn("text-xl font-black", unpaidCount === 0 ? "text-emerald-700" : "text-amber-700")}>
                  {linesTotals.paidCount}/{lines.length}
                </div>
                <div className={cn("text-xs mt-0.5", unpaidCount === 0 ? "text-emerald-600" : "text-amber-600")}>
                  {unpaidCount === 0 ? "전체 지급완료" : `지급완료 (${unpaidCount}개 미지급)`}
                </div>
              </div>
            </div>
          )}

          {!selectedPeriod && (
            <div className="py-10 text-center text-sm text-muted-foreground border border-border rounded-xl">
              이 달은 아직 정산 마감 전입니다.<br />
              <span className="text-xs mt-1 block">아래 &apos;이번달 미정산 현황&apos;에서 수동 마감할 수 있습니다.</span>
            </div>
          )}

          {selectedPeriod && linesErr && (
            <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold mb-3">
              {linesErr}
            </div>
          )}

          {/* 일괄 처리 액션 바 */}
          {selectedPeriod && !linesLoading && lines.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allUnpaidChecked}
                    onChange={() => {
                      if (allUnpaidChecked) {
                        setCheckedIds(new Set());
                      } else {
                        setCheckedIds(new Set(unpaidLines.map((l) => l.id)));
                      }
                    }}
                    className="w-4 h-4 rounded accent-foreground cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">
                    미지급 전체선택
                    {checkedIds.size > 0 && <span className="ml-1 text-foreground">({checkedIds.size}개)</span>}
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                {checkedIds.size > 0 && (
                  <Button
                    onClick={markPaidBulk}
                    disabled={bulkLoading}
                    type="button"
                    size="sm"
                    className="h-8 text-xs font-bold"
                  >
                    {bulkLoading ? "처리 중..." : `선택 ${checkedIds.size}개 일괄 지급완료`}
                  </Button>
                )}
                <button
                  onClick={downloadAllPdfs}
                  type="button"
                  className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-bold hover:bg-muted transition-colors"
                >
                  정산서 일괄 다운로드
                </button>
              </div>
            </div>
          )}

          {bulkMsg && (
            <div className={cn(
              "p-3 rounded-xl text-sm font-semibold mb-3",
              bulkMsg.startsWith("✅")
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-muted border border-border text-muted-foreground"
            )}>
              {bulkMsg}
            </div>
          )}

          {/* 업체 리스트 */}
          {selectedPeriod && <div className="border border-border rounded-xl overflow-hidden">
            {linesLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : sortedLines.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                업체 정산 내역이 없습니다.
              </div>
            ) : (
              <>
                {/* 데스크탑 테이블 */}
                <div className="hidden md:block overflow-x-auto">
                  <div className="min-w-[900px]">
                    <div className="grid grid-cols-[32px_1fr_100px_110px_110px_80px_180px] gap-2 px-4 py-2.5 text-xs font-bold text-muted-foreground border-b border-border bg-muted/30">
                      <div />
                      <div>업체명</div>
                      <div className="text-right">포인트 지급</div>
                      <div className="text-right">사용포인트</div>
                      <div className="text-right">지급예정액</div>
                      <div className="text-center">상태</div>
                      <div className="text-right">처리</div>
                    </div>

                    {sortedLines.map((l) => (
                      <div
                        key={l.id}
                        className={cn(
                          "grid grid-cols-[32px_1fr_100px_110px_110px_80px_180px] gap-2 px-4 py-3.5 border-b border-border last:border-0 text-sm items-center",
                          l.status === "PAID" ? "bg-emerald-50/30" : "bg-amber-50/20"
                        )}
                      >
                        <div className="flex items-center justify-center">
                          {l.status !== "PAID" && (
                            <input
                              type="checkbox"
                              checked={checkedIds.has(l.id)}
                              onChange={() => {
                                const next = new Set(checkedIds);
                                next.has(l.id) ? next.delete(l.id) : next.add(l.id);
                                setCheckedIds(next);
                              }}
                              className="w-4 h-4 rounded accent-foreground cursor-pointer"
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-black text-foreground">
                            {l.counterparty?.name ?? "-"}
                          </div>
                          {(l.payoutRef || l.note) && (
                            <div className="mt-1 flex gap-2 flex-wrap">
                              {l.payoutRef && (
                                <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                                  참조: {l.payoutRef}
                                </span>
                              )}
                              {l.note && (
                                <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                                  {l.note}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right font-bold">{formatNumber(l.issueCount)}건</div>
                        <div className="text-right font-bold">{formatNumber(l.usedPoints)}P</div>
                        <div className="text-right font-black text-foreground">{formatNumber(l.netPayable)}P</div>
                        <div className="flex justify-center">
                          <SettlementStatusBadge status={l.status} />
                        </div>
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          <a
                            href={
                              l.counterparty?.id
                                ? `/${orgSlug}/admin/settlements/print?periodKey=${selectedPeriodKey}&counterpartyId=${l.counterparty.id}`
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
                          {l.status !== "PAID" ? (
                            <button
                              onClick={() => markPaid(l)}
                              type="button"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-foreground bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity"
                            >
                              지급완료
                            </button>
                          ) : (
                            <button
                              onClick={() => cancelPaid(l)}
                              type="button"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-red-200 text-red-600 bg-card text-xs font-bold hover:bg-red-50 transition-colors"
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
                <div className="flex md:hidden flex-col divide-y divide-border">
                  {sortedLines.map((l) => (
                    <article
                      key={l.id}
                      className={cn("p-4", l.status === "PAID" ? "bg-emerald-50/30" : "bg-amber-50/20")}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-2">
                          {l.status !== "PAID" && (
                            <input
                              type="checkbox"
                              checked={checkedIds.has(l.id)}
                              onChange={() => {
                                const next = new Set(checkedIds);
                                next.has(l.id) ? next.delete(l.id) : next.add(l.id);
                                setCheckedIds(next);
                              }}
                              className="w-4 h-4 mt-0.5 rounded accent-foreground cursor-pointer shrink-0"
                            />
                          )}
                          <div>
                            <div className="text-sm font-black text-foreground">
                              {l.counterparty?.name ?? "-"}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-lg font-black text-foreground">{formatNumber(l.netPayable)}P</div>
                          <SettlementStatusBadge status={l.status} />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">포인트 지급</span>
                          <span className="font-bold">{formatNumber(l.issueCount)}건</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">사용포인트</span>
                          <span className="font-bold">{formatNumber(l.usedPoints)}P</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">지급포인트</span>
                          <span className="font-bold">{formatNumber(l.issuedPoints)}P</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">포인트 지급</span>
                          <span className="font-bold">{formatNumber(l.issueCount)}건</span>
                        </div>
                      </div>
                      {(l.payoutRef || l.note) && (
                        <div className="mt-2 flex gap-1.5 flex-wrap">
                          {l.payoutRef && (
                            <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                              참조: {l.payoutRef}
                            </span>
                          )}
                          {l.note && (
                            <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                              {l.note}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <a
                          href={
                            l.counterparty?.id
                              ? `/${orgSlug}/admin/settlements/print?periodKey=${selectedPeriodKey}&counterpartyId=${l.counterparty.id}`
                              : "#"
                          }
                          target="_blank"
                          className={cn(
                            "flex-1 inline-flex items-center justify-center h-9 rounded-xl border border-border bg-card text-foreground font-bold text-sm hover:bg-muted transition-colors",
                            !l.counterparty?.id && "opacity-50 pointer-events-none"
                          )}
                        >
                          정산서
                        </a>
                        {l.status !== "PAID" ? (
                          <button
                            onClick={() => markPaid(l)}
                            type="button"
                            className="flex-1 inline-flex items-center justify-center h-9 rounded-xl border border-foreground bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity"
                          >
                            지급완료
                          </button>
                        ) : (
                          <button
                            onClick={() => cancelPaid(l)}
                            type="button"
                            className="flex-1 inline-flex items-center justify-center h-9 rounded-xl border border-red-200 text-red-600 bg-card font-bold text-sm hover:bg-red-50 transition-colors"
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
          </div>}
        </section>
      )}

      {/* ── 이번달 미정산 현황 (접기/펼치기) ────────────── */}
      <section className="bg-card shadow-card rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          className="w-full flex justify-between items-center px-5 py-4 hover:bg-muted/30 transition-colors"
        >
          <div className="text-left">
            <div className="text-base font-black text-foreground">이번달 미정산 현황 / 수동 마감</div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              아직 마감되지 않은 이번달 포인트 사용 내역
            </div>
          </div>
          {previewOpen
            ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
            : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
          }
        </button>

        {previewOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-border">

            {/* 기간 + 마감 버튼 */}
            <div className="flex gap-3 flex-wrap items-end pt-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-muted-foreground">시작일</span>
                <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="YYYY-MM-DD" className="h-9 w-36" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-muted-foreground">종료일</span>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="YYYY-MM-DD" className="h-9 w-36" />
              </div>
              <Button variant="outline" onClick={loadPreview} type="button" className="h-9">
                미리보기 조회
              </Button>
              <Button onClick={closePeriod} type="button" className="h-9">
                정산 마감
              </Button>
              <a
                href={`/api/admin/settlements/excel?from=${from}&to=${to}`}
                className="inline-flex items-center justify-center h-9 px-4 rounded-xl border border-border bg-card text-foreground font-bold text-sm hover:bg-muted transition-colors"
              >
                미리보기 엑셀
              </a>
            </div>

            {previewMsg && (
              <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
                {previewMsg}
              </div>
            )}
            {closeMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
                {closeMsg}
              </div>
            )}

            {/* 미리보기 테이블 */}
            <div className="border border-border rounded-xl overflow-hidden">
              {previewLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
              ) : preview.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">미정산 내역이 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="grid grid-cols-[1fr_120px_120px_160px] gap-2 px-4 py-2.5 text-xs font-bold text-muted-foreground border-b border-border bg-muted/30">
                      <div>업체명</div>
                      <div className="text-right">사용포인트</div>
                      <div className="text-right">건수</div>
                      <div>마지막 사용일시</div>
                    </div>
                    {preview.map((it, idx) => (
                      <div
                        key={`${it.counterpartyId ?? "null"}-${idx}`}
                        className="grid grid-cols-[1fr_120px_120px_160px] gap-2 px-4 py-3 border-b border-border last:border-0 text-sm items-center"
                      >
                        <div>
                          <div className="font-black text-foreground">
                            {it.counterparty ? it.counterparty.name : "-"}
                          </div>
                        </div>
                        <div className="text-right font-bold">{formatNumber(it.usedPoints)}P</div>
                        <div className="text-right font-bold">{formatNumber(it.useCount)}건</div>
                        <div className="text-xs text-muted-foreground">
                          {it.lastUsedAt ? new Date(it.lastUsedAt).toLocaleString() : "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

    </main>
  );
}
