"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, CheckCircle2 } from "lucide-react";

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
  const [error, setError] = useState("");

  // Find the index of the "정산" column (for auto-sum)
  const settlementColIdx = columns.findIndex((c) => c === "정산");
  const numericColIdx = settlementColIdx >= 0 ? settlementColIdx : -1;

  // Auto-calculate whenever rows change
  useEffect(() => {
    if (numericColIdx < 0) {
      setSubtotal(0);
      setTax(0);
      setTotal(0);
      return;
    }
    const sum = rows.reduce((acc, row) => {
      const val = parseFloat((row.cells[numericColIdx] || "0").replace(/,/g, ""));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const taxVal = Math.round(sum * 0.1);
    setSubtotal(sum);
    setTax(taxVal);
    setTotal(sum + taxVal);
  }, [rows, numericColIdx]);

  // Load existing draft for current month
  const loadExisting = useCallback(
    async (y: number, m: number) => {
      setLoading(true);
      setError("");
      try {
        const [settlementsRes, profileRes] = await Promise.all([
          fetch("/api/partner/general-settlements"),
          fetch("/api/partner/profile"),
        ]);
        const data = await settlementsRes.json();
        const profileData = await profileRes.json();

        if (profileData?.ok && profileData?.profile) {
          setPartnerName(profileData.profile.businessName || profileData.profile.name || "");
        }

        if (!data.ok) return;

        // Find draft for selected year/month
        const draft: SettlementDoc | undefined = data.items.find(
          (it: SettlementDoc) => it.year === y && it.month === m && it.status === "DRAFT"
        );

        if (draft) {
          setExistingId(draft.id);
          setColumns(draft.columns ?? [...DEFAULT_COLUMNS]);
          const loadedRows = draft.rows ?? [];
          setRows(
            loadedRows.length > 0
              ? loadedRows
              : makeEmptyRows(DEFAULT_ROW_COUNT, (draft.columns ?? DEFAULT_COLUMNS).length)
          );
          setPeriodStart(draft.periodStart || `${m}/1`);
          setPeriodEnd(
            draft.periodEnd ||
              `${m}/${new Date(y, m, 0).getDate()}`
          );
        } else {
          // Check if submitted version exists
          const submitted: SettlementDoc | undefined = data.items.find(
            (it: SettlementDoc) => it.year === y && it.month === m && it.status === "SUBMITTED"
          );
          if (submitted) {
            setExistingId(submitted.id);
            setColumns(submitted.columns ?? [...DEFAULT_COLUMNS]);
            setRows(submitted.rows ?? makeEmptyRows(DEFAULT_ROW_COUNT, (submitted.columns ?? DEFAULT_COLUMNS).length));
            setPeriodStart(submitted.periodStart || `${m}/1`);
            setPeriodEnd(submitted.periodEnd || `${m}/${new Date(y, m, 0).getDate()}`);
            setSubmitted(true);
          } else {
            setExistingId(null);
            setColumns([...DEFAULT_COLUMNS]);
            setRows(makeEmptyRows(DEFAULT_ROW_COUNT, DEFAULT_COLUMNS.length));
            setPeriodStart(`${m}/1`);
            setPeriodEnd(`${m}/${new Date(y, m, 0).getDate()}`);
            setSubmitted(false);
          }
        }
      } catch {
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    loadExisting(year, month);
  }, [year, month, loadExisting]);

  // Column management
  function updateColumnHeader(idx: number, value: string) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? value : c)));
  }

  function addColumn() {
    setColumns((prev) => [...prev, "항목"]);
    setRows((prev) =>
      prev.map((row) => ({ cells: [...row.cells, ""] }))
    );
  }

  function removeColumn(idx: number) {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, i) => i !== idx));
    setRows((prev) =>
      prev.map((row) => ({ cells: row.cells.filter((_, i) => i !== idx) }))
    );
  }

  // Row management
  function updateCell(rowIdx: number, colIdx: number, value: string) {
    setRows((prev) =>
      prev.map((row, ri) =>
        ri === rowIdx
          ? { cells: row.cells.map((c, ci) => (ci === colIdx ? value : c)) }
          : row
      )
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { cells: Array.from({ length: columns.length }, () => "") }]);
  }

  // Save
  async function save(status: "DRAFT" | "SUBMITTED") {
    setSaving(true);
    setError("");
    try {
      const body = {
        year,
        month,
        periodStart,
        periodEnd,
        columns,
        rows,
        subtotal,
        tax,
        total,
        status,
      };

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
      if (!data.ok) {
        setError(data.message || "저장에 실패했습니다.");
        return;
      }

      if (!existingId && data.id) {
        setExistingId(data.id);
      }

      if (status === "SUBMITTED") {
        setSubmitted(true);
      }
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // Year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">일반 정산</h1>
          <p className="text-sm text-muted-foreground mt-1">여행사 정산 내역을 입력하세요.</p>
        </div>
        <div className="bg-card shadow-card rounded-2xl p-6 animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-40" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-foreground tracking-tight">일반 정산</h1>
        <p className="text-sm text-muted-foreground mt-1">여행사 정산 내역을 입력하세요.</p>
      </div>

      {submitted && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          전송이 완료되었습니다. 해당 월 정산이 제출되었습니다.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-card shadow-card rounded-2xl overflow-hidden">
        {/* Header: company name + period selector */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: company name */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">업체명</p>
              <p className="text-base font-black text-foreground">{partnerName || "—"}</p>
            </div>

            {/* Right: year + month + period */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  disabled={submitted}
                  className="text-sm font-semibold border border-border rounded-lg px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[oklch(0.52_0.27_264)] disabled:opacity-50"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  disabled={submitted}
                  className="text-sm font-semibold border border-border rounded-lg px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[oklch(0.52_0.27_264)] disabled:opacity-50"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="text-xs font-semibold">정산기간</span>
                <input
                  type="text"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  disabled={submitted}
                  placeholder="3/1"
                  className="w-14 text-center text-sm border border-border rounded-md px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.52_0.27_264)] disabled:opacity-50"
                />
                <span>~</span>
                <input
                  type="text"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  disabled={submitted}
                  placeholder="3/31"
                  className="w-14 text-center text-sm border border-border rounded-md px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.52_0.27_264)] disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table section label */}
        <div className="px-5 pt-4 pb-1">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">상세내역</p>
        </div>

        {/* Editable table */}
        <div className="px-4 pb-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[520px]">
            <thead>
              <tr>
                <th className="border border-border bg-muted/50 px-2 py-1.5 text-xs font-bold text-muted-foreground w-8 text-center">
                  #
                </th>
                {columns.map((col, ci) => (
                  <th key={ci} className="border border-border bg-muted/50 px-1 py-1 min-w-[80px]">
                    <div className="flex items-center gap-0.5">
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => updateColumnHeader(ci, e.target.value)}
                        disabled={submitted}
                        className="flex-1 text-xs font-bold text-center bg-transparent focus:outline-none focus:bg-background focus:rounded px-1 py-0.5 min-w-0 disabled:opacity-60"
                      />
                      {!submitted && (
                        <button
                          type="button"
                          onClick={() => removeColumn(ci)}
                          className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                          title="열 삭제"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {!submitted && (
                  <th className="border border-border bg-muted/50 px-2 py-1 w-8">
                    <button
                      type="button"
                      onClick={addColumn}
                      className="text-muted-foreground hover:text-[oklch(0.52_0.27_264)] transition-colors mx-auto flex"
                      title="열 추가"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/20">
                  <td className="border border-border px-2 py-1 text-center text-xs text-muted-foreground font-semibold">
                    {ri + 1}
                  </td>
                  {columns.map((_, ci) => (
                    <td key={ci} className="border border-border p-0">
                      <input
                        type="text"
                        value={row.cells[ci] ?? ""}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        disabled={submitted}
                        className="w-full px-2 py-1.5 text-xs bg-transparent focus:outline-none focus:bg-[oklch(0.52_0.27_264)]/5 disabled:opacity-60"
                        inputMode={ci === numericColIdx ? "numeric" : "text"}
                      />
                    </td>
                  ))}
                  {!submitted && <td className="border border-border" />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row button */}
        {!submitted && (
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-lg hover:bg-muted"
            >
              <Plus className="w-3.5 h-3.5" />
              줄 추가
            </button>
          </div>
        )}

        {/* Summary rows */}
        <div className="border-t border-border mx-4 mb-4">
          <table className="w-full border-collapse text-sm min-w-[520px]">
            <tbody>
              <tr>
                <td className="border border-border px-3 py-2 bg-muted/30 font-bold text-xs text-right" colSpan={columns.length}>
                  합계
                </td>
                <td className="border border-border px-3 py-2 bg-muted/30 font-black text-sm text-right min-w-[80px]">
                  {formatMoney(subtotal)}
                </td>
                {!submitted && <td className="border border-border bg-muted/30 w-8" />}
              </tr>
              <tr>
                <td className="border border-border px-3 py-2 bg-muted/30 font-bold text-xs text-right" colSpan={columns.length}>
                  부가세 (10%)
                </td>
                <td className="border border-border px-3 py-2 bg-muted/30 font-semibold text-sm text-right">
                  {formatMoney(tax)}
                </td>
                {!submitted && <td className="border border-border bg-muted/30 w-8" />}
              </tr>
              <tr>
                <td className="border border-border px-3 py-2 bg-[oklch(0.52_0.27_264)]/10 font-black text-xs text-right" colSpan={columns.length}>
                  총 정산 금액
                </td>
                <td className="border border-border px-3 py-2 bg-[oklch(0.52_0.27_264)]/10 font-black text-base text-right text-[oklch(0.52_0.27_264)]">
                  {formatMoney(total)}
                </td>
                {!submitted && <td className="border border-border bg-[oklch(0.52_0.27_264)]/10 w-8" />}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        {!submitted && (
          <div className="flex gap-3 px-5 pb-5">
            <button
              type="button"
              onClick={() => save("DRAFT")}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "임시저장"}
            </button>
            <button
              type="button"
              onClick={() => save("SUBMITTED")}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[oklch(0.52_0.27_264)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "전송 중..." : "전송"}
            </button>
          </div>
        )}

        {submitted && (
          <div className="px-5 pb-5">
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setYear(now.getFullYear());
                setMonth(now.getMonth() + 1);
                setExistingId(null);
                setColumns([...DEFAULT_COLUMNS]);
                setRows(makeEmptyRows(DEFAULT_ROW_COUNT, DEFAULT_COLUMNS.length));
                setPeriodStart(`${now.getMonth() + 1}/1`);
                setPeriodEnd(`${now.getMonth() + 1}/${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`);
                setError("");
              }}
              className="w-full py-2.5 rounded-xl text-sm font-bold border border-border bg-background text-foreground hover:bg-muted transition-colors"
            >
              새 정산 작성
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
