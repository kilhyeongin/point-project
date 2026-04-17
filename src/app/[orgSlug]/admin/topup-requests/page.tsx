"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Check, Search, X } from "lucide-react";
import { formatUsername } from "@/lib/utils";

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

type Tab = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

function fmt(n: number) {
  return Number(n || 0).toLocaleString();
}

function fmtDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}.${dd} ${hh}:${min}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING")
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">
        대기 중
      </span>
    );
  if (status === "APPROVED")
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
        승인완료
      </span>
    );
  if (status === "REJECTED")
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200">
        거절
      </span>
    );
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500">
      {status}
    </span>
  );
}

export default function TopupRequestsPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [searchQ, setSearchQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((i) => i.status === "PENDING").length,
    approved: items.filter((i) => i.status === "APPROVED").length,
    rejected: items.filter((i) => i.status === "REJECTED").length,
  }), [items]);

  const filtered = useMemo(() => {
    let list = tab === "ALL" ? items : items.filter((i) => i.status === tab);

    // 이름/아이디 검색
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter((i) =>
        i.account?.name?.toLowerCase().includes(q) ||
        i.account?.username?.toLowerCase().includes(q)
      );
    }

    // 날짜 범위 필터 (요청일 기준)
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((i) => new Date(i.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((i) => new Date(i.createdAt) <= to);
    }

    return [...list].sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (b.status === "PENDING" && a.status !== "PENDING") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, tab, searchQ, dateFrom, dateTo]);

  function clearFilters() {
    setSearchQ("");
    setDateFrom("");
    setDateTo("");
  }

  const hasFilter = searchQ.trim() !== "" || dateFrom !== "" || dateTo !== "";

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/topup-requests");
      const data = await res.json();
      if (!res.ok) { toast.error(data?.message ?? "목록 조회 실패"); return; }
      setItems(data.items || []);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setWorkingId(id);
    try {
      const res = await fetch(`/api/admin/topup-requests/${id}/approve`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok || !data.ok) { toast.error(data?.message ?? "승인 실패"); return; }
      toast.success("충전 요청을 승인했습니다.");
      await load(true);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setWorkingId(null);
    }
  }

  useEffect(() => { load(); }, []);

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "PENDING", label: "대기 중", count: counts.pending },
    { key: "ALL",     label: "전체",    count: counts.all },
    { key: "APPROVED",label: "승인완료", count: counts.approved },
    { key: "REJECTED",label: "거절",    count: counts.rejected },
  ];

  return (
    <main className="tr-wrap">

      {/* ── 헤더 ── */}
      <header className="tr-header">
        <div className="tr-header__left">
          <p className="tr-header__eyebrow">포인트 관리</p>
          <h1 className="tr-header__title">충전 요청 승인</h1>
          <p className="tr-header__desc">
            제휴사의 포인트 충전 요청을 검토하고 승인합니다. 승인 즉시 잔액에 반영됩니다.
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="tr-refresh-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </header>

      {/* ── 요약 수치 ── */}
      <div className="tr-kpi-row">
        <button className="tr-kpi tr-kpi--btn" onClick={() => setTab("ALL")}>
          <span className="tr-kpi__num">{counts.all}</span>
          <span className="tr-kpi__label">전체 요청</span>
        </button>
        <button className="tr-kpi tr-kpi--accent tr-kpi--btn" onClick={() => setTab("PENDING")}>
          <span className="tr-kpi__num">{counts.pending}</span>
          <span className="tr-kpi__label">대기 중</span>
        </button>
        <button className="tr-kpi tr-kpi--btn" onClick={() => setTab("APPROVED")}>
          <span className="tr-kpi__num">{counts.approved}</span>
          <span className="tr-kpi__label">승인완료</span>
        </button>
      </div>

      {/* ── 필터 ── */}
      <div className="tr-filter-bar">
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="제휴사 이름 또는 아이디 검색"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="tr-filter-search__input"
            style={{ paddingLeft: 32 }}
          />
        </div>
        <div className="tr-filter-dates">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="tr-filter-date"
          />
          <span className="tr-filter-sep">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="tr-filter-date"
          />
        </div>
        {hasFilter && (
          <button onClick={clearFilters} className="tr-filter-clear">
            <X className="w-3.5 h-3.5" />
            초기화
          </button>
        )}
      </div>

      {/* ── 탭 + 목록 묶음 ── */}
      <div className="tr-panel">
        <div className="tr-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`tr-tab ${tab === t.key ? "tr-tab--active" : ""}`}
            >
              {t.label}
              <span className="tr-tab__count">{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── 목록 ── */}
        {loading ? (
          <div className="tr-loading">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>불러오는 중</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="tr-empty">
            {tab === "PENDING" ? "대기 중인 충전 요청이 없습니다." : "해당 조건의 요청이 없습니다."}
          </div>
        ) : (
          <div className="tr-list">
            {filtered.map((it) => (
              <article
                key={it.id}
                className={`tr-card ${it.status === "PENDING" ? "tr-card--pending" : ""}`}
              >
                {/* 상단: 제휴사 + 상태 + 금액 */}
                <div className="tr-card__top">
                  <div className="tr-card__who">
                    <span className="tr-card__name">{it.account?.name ?? "-"}</span>
                    <span className="tr-card__username">
                      {it.account ? formatUsername(it.account.username) : "-"}
                    </span>
                    <StatusBadge status={it.status} />
                  </div>
                  <div className="tr-card__amount">
                    {fmt(it.amount)}<span className="tr-card__amount-unit">P</span>
                  </div>
                </div>

                {/* 메타 정보 */}
                <div className="tr-card__meta">
                  <span>요청 {fmtDate(it.createdAt)}</span>
                  {it.requestedBy && <span>· 요청자 {it.requestedBy.name}</span>}
                  {it.status !== "PENDING" && it.approvedBy && (
                    <span>· 처리자 {it.approvedBy.name} {fmtDate(it.decidedAt)}</span>
                  )}
                </div>

                {/* 메모 */}
                {it.note && (
                  <p className="tr-card__note">{it.note}</p>
                )}

                {/* 승인 버튼 */}
                {it.status === "PENDING" && (
                  <div className="tr-card__action">
                    <button
                      onClick={() => approve(it.id)}
                      disabled={workingId === it.id}
                      className="tr-approve-btn"
                    >
                      {workingId === it.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />처리 중</>
                      ) : (
                        <><Check className="w-3.5 h-3.5" />승인하기</>
                      )}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        /* ── 레이아웃 ── */
        .tr-wrap {
          max-width: 720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── 헤더 ── */
        .tr-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          padding: 24px 28px;
        }
        .tr-header__eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #71717a;
          margin-bottom: 6px;
        }
        .tr-header__title {
          font-size: 22px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }
        .tr-header__desc {
          margin-top: 6px;
          font-size: 13px;
          color: #71717a;
          line-height: 1.6;
        }
        .tr-refresh-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 14px;
          border-radius: 8px;
          border: 1px solid #e4e4e7;
          background: #fafafa;
          color: #3f3f46;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .tr-refresh-btn:hover { background: #f4f4f5; border-color: #a1a1aa; }
        .tr-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── KPI ── */
        .tr-kpi-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .tr-kpi {
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tr-kpi--btn {
          cursor: pointer;
          text-align: left;
        }
        .tr-kpi--accent {
          background: #2563eb;
          border-color: #2563eb;
        }
        .tr-kpi--accent .tr-kpi__num { color: #fff; }
        .tr-kpi--accent .tr-kpi__label { color: rgba(255,255,255,0.75); }
        .tr-kpi__num {
          font-size: 26px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .tr-kpi__label {
          font-size: 12px;
          font-weight: 600;
          color: #71717a;
        }

        /* ── 필터 ── */
        .tr-filter-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 14px 18px;
        }
        .tr-filter-search__input {
          width: 100%;
          height: 36px;
          padding: 0 12px 0 32px;
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          font-size: 13px;
          color: #09090b;
          background: #fafafa;
          outline: none;
          transition: border-color 0.15s;
        }
        .tr-filter-search__input::placeholder { color: #a1a1aa; }
        .tr-filter-search__input:focus { border-color: #2563eb; background: #fff; }
        .tr-filter-dates {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .tr-filter-date {
          height: 36px;
          padding: 0 10px;
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          font-size: 13px;
          color: #09090b;
          background: #fafafa;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .tr-filter-date:focus { border-color: #2563eb; background: #fff; }
        .tr-filter-sep {
          font-size: 13px;
          color: #a1a1aa;
          font-weight: 600;
        }
        .tr-filter-clear {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 36px;
          padding: 0 12px;
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          background: #fafafa;
          color: #71717a;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .tr-filter-clear:hover { border-color: #dc2626; color: #dc2626; background: #fff5f5; }

        /* ── 탭 + 목록 패널 ── */
        .tr-panel {
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          overflow: hidden;
        }
        .tr-tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid #e4e4e7;
          padding: 0 4px;
          background: #fafafa;
        }
        .tr-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 42px;
          padding: 0 16px;
          border: none;
          border-bottom: 2px solid transparent;
          background: transparent;
          font-size: 13px;
          font-weight: 600;
          color: #71717a;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .tr-tab:hover { color: #2563eb; }
        .tr-tab--active {
          color: #2563eb;
          border-bottom-color: #2563eb;
        }
        .tr-tab__count {
          font-size: 11px;
          font-weight: 700;
          color: #a1a1aa;
          background: #f4f4f5;
          border-radius: 20px;
          padding: 1px 7px;
          min-width: 20px;
          text-align: center;
        }
        .tr-tab--active .tr-tab__count {
          background: #2563eb;
          color: #fff;
        }

        /* ── 로딩 / 빈 상태 ── */
        .tr-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 60px 0;
          color: #71717a;
          font-size: 13px;
          font-weight: 600;
        }
        .tr-empty {
          padding: 60px 0;
          text-align: center;
          font-size: 13px;
          color: #a1a1aa;
        }

        /* ── 카드 ── */
        .tr-list { display: flex; flex-direction: column; gap: 0; padding: 8px 16px 16px; }
        .tr-card {
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 18px 22px;
          margin-top: 8px;
          transition: border-color 0.15s;
        }
        .tr-card--pending {
          border-left: 3px solid #2563eb;
        }
        .tr-card__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .tr-card__who {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tr-card__name {
          font-size: 15px;
          font-weight: 800;
          color: #09090b;
          letter-spacing: -0.02em;
        }
        .tr-card__username {
          font-size: 12px;
          color: #a1a1aa;
          font-weight: 500;
        }
        .tr-card__amount {
          font-size: 22px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.04em;
          white-space: nowrap;
          line-height: 1;
        }
        .tr-card__amount-unit {
          font-size: 14px;
          font-weight: 700;
          margin-left: 2px;
          color: #71717a;
        }
        .tr-card__meta {
          margin-top: 8px;
          font-size: 12px;
          color: #a1a1aa;
          font-weight: 500;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tr-card__note {
          margin-top: 10px;
          font-size: 13px;
          color: #52525b;
          padding: 10px 14px;
          background: #fafafa;
          border: 1px solid #f4f4f5;
          border-radius: 8px;
          line-height: 1.5;
        }
        .tr-card__action {
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
          padding-top: 14px;
          border-top: 1px solid #f4f4f5;
        }
        .tr-approve-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 38px;
          padding: 0 20px;
          border-radius: 8px;
          border: none;
          background: #2563eb;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .tr-approve-btn:hover { opacity: 0.85; }
        .tr-approve-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── 상태 뱃지 ── */
        .tr-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid transparent;
          white-space: nowrap;
          line-height: 1;
        }
        .tr-badge--pending {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }
        .tr-badge--approved {
          background: #fff;
          color: #16a34a;
          border-color: #bbf7d0;
        }
        .tr-badge--rejected {
          background: #fff;
          color: #dc2626;
          border-color: #fecaca;
        }

        /* ── 반응형 ── */
        @media (max-width: 600px) {
          .tr-header { padding: 18px 20px; }
          .tr-card { padding: 16px 18px; }
          .tr-kpi-row { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .tr-kpi { padding: 12px 14px; }
          .tr-kpi__num { font-size: 22px; }
        }
      `}</style>
    </main>
  );
}
