"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, CheckCircle2, Building2, CalendarDays } from "lucide-react";

const DEFAULT_COLUMNS = ["예식일", "출발일", "손님 성함", "여행지", "정산", "비고"];
const DEFAULT_ROW_COUNT = 11;

function makeEmptyRows(count: number, colCount: number) {
  return Array.from({ length: count }, () => ({
    cells: Array.from({ length: colCount }, () => ""),
  }));
}

function formatMoney(n: number) {
  return Number(n || 0).toLocaleString();
}

type Row = { cells: string[] };

type SettlementDoc = {
  id: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  partnerName: string;
  columns: string[];
  rows: Row[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
};

export default function GeneralSettlementPage() {
  const now = new Date();

  const [partnerName, setPartnerName] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [periodStart, setPeriodStart] = useState(`${now.getMonth() + 1}/1`);
  const [periodEnd, setPeriodEnd] = useState(
    `${now.getMonth() + 1}/${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`
  );
  const [columns, setColumns] = useState<string[]>([...DEFAULT_COLUMNS]);
  const [rows, setRows] = useState<Row[]>(makeEmptyRows(DEFAULT_ROW_COUNT, DEFAULT_COLUMNS.length));

  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);

  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [error, setError] = useState("");

  const settlementColIdx = columns.findIndex((c) => c === "정산");
  const numericColIdx = settlementColIdx >= 0 ? settlementColIdx : -1;

  useEffect(() => {
    if (numericColIdx < 0) { setSubtotal(0); setTax(0); setTotal(0); return; }
    const sum = rows.reduce((acc, row) => {
      const val = parseFloat((row.cells[numericColIdx] || "0").replace(/,/g, ""));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const taxVal = Math.round(sum * 0.1);
    setSubtotal(sum);
    setTax(taxVal);
    setTotal(sum + taxVal);
  }, [rows, numericColIdx]);

  const loadExisting = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError("");
    setSavedDraft(false);
    try {
      const [settlementsRes, profileRes, templateRes] = await Promise.all([
        fetch("/api/partner/general-settlements"),
        fetch("/api/partner/profile"),
        fetch("/api/partner/settlement-columns"),
      ]);
      const data = await settlementsRes.json();
      const profileData = await profileRes.json();
      const templateData = await templateRes.json();

      if (profileData?.ok && profileData?.item) {
        setPartnerName(
          profileData.item.businessName || profileData.item.name || ""
        );
      }

      // 저장된 컬럼 템플릿 (없으면 기본값)
      const savedTemplate: string[] =
        templateData?.ok && templateData.columns?.length > 0
          ? templateData.columns
          : [...DEFAULT_COLUMNS];

      if (!data.ok) return;

      const draft: SettlementDoc | undefined = data.items.find(
        (it: SettlementDoc) => it.year === y && it.month === m && it.status === "DRAFT"
      );
      const submitted_doc: SettlementDoc | undefined = data.items.find(
        (it: SettlementDoc) => it.year === y && it.month === m && it.status === "SUBMITTED"
      );

      const target = draft ?? submitted_doc;
      if (target) {
        // 기존 정산서가 있으면 그대로 불러오기
        setExistingId(target.id);
        setColumns(target.columns ?? savedTemplate);
        setRows(
          target.rows?.length > 0
            ? target.rows
            : makeEmptyRows(DEFAULT_ROW_COUNT, (target.columns ?? savedTemplate).length)
        );
        setPeriodStart(target.periodStart || `${m}/1`);
        setPeriodEnd(target.periodEnd || `${m}/${new Date(y, m, 0).getDate()}`);
        setSubmitted(target.status === "SUBMITTED");
      } else {
        // 새 정산: 저장된 컬럼 템플릿으로 시작
        setExistingId(null);
        setColumns(savedTemplate);
        setRows(makeEmptyRows(DEFAULT_ROW_COUNT, savedTemplate.length));
        setPeriodStart(`${m}/1`);
        setPeriodEnd(`${m}/${new Date(y, m, 0).getDate()}`);
        setSubmitted(false);
      }
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExisting(year, month); }, [year, month, loadExisting]);

  function updateColumnHeader(idx: number, value: string) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? value : c)));
  }
  function addColumn() {
    setColumns((prev) => [...prev, "항목"]);
    setRows((prev) => prev.map((row) => ({ cells: [...row.cells, ""] })));
  }
  function removeColumn(idx: number) {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, i) => i !== idx));
    setRows((prev) => prev.map((row) => ({ cells: row.cells.filter((_, i) => i !== idx) })));
  }
  function updateCell(rowIdx: number, colIdx: number, value: string) {
    setRows((prev) =>
      prev.map((row, ri) =>
        ri === rowIdx ? { cells: row.cells.map((c, ci) => (ci === colIdx ? value : c)) } : row
      )
    );
  }
  function addRow() {
    setRows((prev) => [...prev, { cells: Array.from({ length: columns.length }, () => "") }]);
  }

  async function save(status: "DRAFT" | "SUBMITTED") {
    setSaving(true);
    setError("");
    setSavedDraft(false);
    try {
      const body = { year, month, periodStart, periodEnd, columns, rows, subtotal, tax, total, status };
      let res: Response;
      if (existingId) {
        res = await fetch(`/api/partner/general-settlements/${existingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/partner/general-settlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!data.ok) { setError(data.message || "저장에 실패했습니다."); return; }
      if (!existingId && data.id) setExistingId(data.id);
      if (status === "SUBMITTED") setSubmitted(true);
      if (status === "DRAFT") setSavedDraft(true);

      // 컬럼 구조 템플릿 자동 저장 (백그라운드, 실패해도 무시)
      fetch("/api/partner/settlement-columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      }).catch(() => {});
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <div className="bg-card shadow-card rounded-2xl p-6 animate-pulse space-y-5">
          <div className="flex justify-between">
            <div className="h-7 bg-muted rounded-lg w-40" />
            <div className="h-7 bg-muted rounded-lg w-32" />
          </div>
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl">
      {/* 상태 배너 */}
      {submitted && (
        <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-semibold"
          style={{ background: "oklch(0.95 0.05 160)", color: "oklch(0.4 0.15 155)", border: "1px solid oklch(0.88 0.08 160)" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {year}년 {month}월 정산이 전송 완료되었습니다.
        </div>
      )}
      {savedDraft && !submitted && (
        <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-semibold"
          style={{ background: "oklch(0.96 0.015 264)", color: "oklch(0.4 0.15 264)", border: "1px solid oklch(0.88 0.05 264)" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          임시저장 되었습니다.
        </div>
      )}
      {error && (
        <div className="rounded-2xl px-5 py-3.5 text-sm font-semibold bg-destructive/8 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      <div className="bg-card shadow-card rounded-2xl overflow-hidden">
        {/* ── 헤더 섹션 ── */}
        <div className="px-6 py-5 border-b border-border"
          style={{ background: "linear-gradient(135deg, oklch(0.97 0.008 264) 0%, oklch(0.99 0.002 250) 100%)" }}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            {/* 업체명 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "oklch(0.52 0.27 264)" }}>
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">업체명</p>
                <p className="text-lg font-black text-foreground leading-tight">
                  {partnerName || "—"}
                </p>
              </div>
            </div>

            {/* 정산 월 + 기간 */}
            <div className="flex flex-col items-start sm:items-end gap-2.5">
              {/* 연/월 선택 */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    disabled={submitted}
                    className="text-sm font-black text-foreground bg-transparent focus:outline-none disabled:opacity-50 cursor-pointer"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}년</option>
                    ))}
                  </select>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    disabled={submitted}
                    className="text-sm font-black text-foreground bg-transparent focus:outline-none disabled:opacity-50 cursor-pointer"
                    style={{ color: "oklch(0.52 0.27 264)" }}
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                </div>
                <div className="px-3 py-1.5 rounded-xl text-xs font-black text-white shrink-0"
                  style={{ background: "oklch(0.52 0.27 264)" }}>
                  정산
                </div>
              </div>

              {/* 기간 */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-background">
                <span className="text-xs font-semibold text-muted-foreground">기간</span>
                <input
                  type="text"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  disabled={submitted}
                  placeholder="3/1"
                  className="w-12 text-center text-sm font-bold text-foreground bg-transparent focus:outline-none disabled:opacity-50"
                />
                <span className="text-muted-foreground text-sm">~</span>
                <input
                  type="text"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  disabled={submitted}
                  placeholder="3/31"
                  className="w-12 text-center text-sm font-bold text-foreground bg-transparent focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 상세 내역 레이블 ── */}
        <div className="px-6 pt-5 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-black text-foreground tracking-wide">상 세 내 역</h2>
          {!submitted && (
            <button
              type="button"
              onClick={addColumn}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-3.5 h-3.5" />
              열 추가
            </button>
          )}
        </div>

        {/* ── 테이블 ── */}
        <div className="px-4 pb-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: `${Math.max(600, columns.length * 110 + 60)}px` }}>
            <thead>
              <tr style={{ height: "40px" }}>
                <th className="border border-border/60 px-2 text-xs font-bold text-muted-foreground w-10 text-center"
                  style={{ background: "oklch(0.97 0.008 264)", height: "40px" }}>
                  번호
                </th>
                {columns.map((col, ci) => (
                  <th key={ci} className="border border-border/60 px-1 min-w-[90px]"
                    style={{ background: "oklch(0.97 0.008 264)", height: "40px" }}>
                    <div className="flex items-center justify-center gap-0.5 h-full">
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => updateColumnHeader(ci, e.target.value)}
                        disabled={submitted}
                        className="flex-1 text-xs font-black text-center text-foreground bg-transparent focus:outline-none focus:bg-background focus:rounded px-1 py-0.5 min-w-0 disabled:opacity-70 h-full"
                      />
                      {!submitted && columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeColumn(ci)}
                          className="text-muted-foreground/50 hover:text-red-500 transition-colors flex-shrink-0 p-0.5 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"} style={{ height: "36px" }}>
                  <td className="border border-border/60 px-2 text-center text-xs font-bold text-muted-foreground" style={{ height: "36px" }}>
                    {ri + 1}
                  </td>
                  {columns.map((_, ci) => (
                    <td key={ci} className="border border-border/60 p-0" style={{ height: "36px" }}>
                      <input
                        type="text"
                        value={row.cells[ci] ?? ""}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        disabled={submitted}
                        className="w-full px-2.5 py-1.5 text-xs text-foreground bg-transparent focus:outline-none focus:bg-[oklch(0.52_0.27_264)]/5 disabled:opacity-60 transition-colors"
                        inputMode={ci === numericColIdx ? "numeric" : "text"}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 줄 추가 버튼 */}
        {!submitted && (
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors py-1.5 px-3 rounded-lg hover:bg-muted border border-dashed border-border"
            >
              <Plus className="w-3.5 h-3.5" />
              줄 추가
            </button>
          </div>
        )}

        {/* ── 합계 섹션 ── */}
        <div className="mx-4 mb-5 rounded-xl overflow-hidden border border-border">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-sm font-bold text-muted-foreground">합계</span>
            <span className="text-sm font-black text-foreground">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-sm font-bold text-muted-foreground">부가세 (10%)</span>
            <span className="text-sm font-semibold text-foreground">{formatMoney(tax)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ background: "oklch(0.96 0.015 264)" }}>
            <span className="text-sm font-black text-foreground">총 정산 금액</span>
            <span className="text-xl font-black" style={{ color: "oklch(0.52 0.27 264)" }}>
              {formatMoney(total)}
            </span>
          </div>
        </div>

        {/* ── 액션 버튼 ── */}
        {!submitted ? (
          <div className="flex gap-3 px-5 pb-5">
            <button
              type="button"
              onClick={() => save("DRAFT")}
              disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-bold border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "임시저장"}
            </button>
            <button
              type="button"
              onClick={() => save("SUBMITTED")}
              disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}
            >
              {saving ? "전송 중..." : "관리자에게 전송"}
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <button
              type="button"
              onClick={() => loadExisting(now.getFullYear(), now.getMonth() + 1)}
              className="w-full py-3 rounded-2xl text-sm font-bold border border-border bg-background text-foreground hover:bg-muted transition-colors"
            >
              새 정산 작성
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
