"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { formatUsername } from "@/lib/utils";

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
        지급완료
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

export default function AdminIssueRequestsPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((i) => i.status === "PENDING").length,
    approved: items.filter((i) => i.status === "APPROVED").length,
    rejected: items.filter((i) => i.status === "REJECTED").length,
  }), [items]);

  const totalAmount = useMemo(
    () => items
      .filter((i) => i.status === "APPROVED")
      .reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [items]
  );

  const filtered = useMemo(() => {
    let list = tab === "ALL" ? items : items.filter((i) => i.status === tab);
    if (q.trim()) {
      const qLower = q.trim().toLowerCase();
      list = list.filter((i) =>
        i.customer?.name?.toLowerCase().includes(qLower) ||
        i.customer?.username?.toLowerCase().includes(qLower) ||
        i.requester?.name?.toLowerCase().includes(qLower) ||
        i.requester?.username?.toLowerCase().includes(qLower)
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [items, tab, q]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/issue-requests");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data?.message ?? "목록 조회 실패");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "ALL",      label: "전체",    count: counts.all },
    { key: "APPROVED", label: "지급완료", count: counts.approved },
    { key: "PENDING",  label: "대기 중",  count: counts.pending },
    { key: "REJECTED", label: "거절",    count: counts.rejected },
  ];

  return (
    <main className="ir-wrap">

      {/* ── 헤더 ── */}
      <header className="ir-header">
        <div className="ir-header__left">
          <p className="ir-header__eyebrow">포인트 관리</p>
          <h1 className="ir-header__title">포인트 지급 이력</h1>
          <p className="ir-header__desc">
            제휴사가 고객에게 지급한 포인트 이력을 조회합니다. 지급은 잔액 범위 내에서 즉시 실행됩니다.
          </p>
        </div>
        <button onClick={() => load()} disabled={loading} className="ir-refresh-btn">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </header>

      {/* ── 검색 ── */}
      <div className="ir-search-row">
        <Search className="ir-search-icon w-4 h-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="고객 또는 제휴사 이름·아이디 검색"
          className="ir-search-input"
        />
        {q && (
          <button onClick={() => setQ("")} className="ir-search-clear">✕</button>
        )}
      </div>

      {/* ── KPI ── */}
      <div className="ir-kpi-row">
        <div className="ir-kpi">
          <span className="ir-kpi__num">{counts.all}</span>
          <span className="ir-kpi__label">전체 이력</span>
        </div>
        <div className="ir-kpi ir-kpi--accent">
          <span className="ir-kpi__num">{counts.approved}</span>
          <span className="ir-kpi__label">지급완료</span>
        </div>
        <div className="ir-kpi">
          <span className="ir-kpi__num">
            {fmt(totalAmount)}<span style={{ fontSize: "14px", fontWeight: 700, marginLeft: "2px", color: "#71717a" }}>P</span>
          </span>
          <span className="ir-kpi__label">지급 총 포인트</span>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="ir-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`ir-tab ${tab === t.key ? "ir-tab--active" : ""}`}
          >
            {t.label}
            <span className="ir-tab__count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── 목록 ── */}
      {loading ? (
        <div className="ir-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>불러오는 중</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ir-empty">
          {q ? `"${q}" 검색 결과가 없습니다.` : "해당 조건의 지급 이력이 없습니다."}
        </div>
      ) : (
        <div className="ir-list">
          {filtered.map((it) => (
            <article key={it.id} className="ir-card">
              <div className="ir-card__top">
                <div className="ir-card__who">
                  <span className="ir-card__name">{it.customer?.name ?? "-"}</span>
                  <span className="ir-card__username">
                    {it.customer ? formatUsername(it.customer.username) : "-"}
                  </span>
                  <StatusBadge status={it.status} />
                </div>
                <div className="ir-card__amount">
                  {fmt(it.amount)}<span className="ir-card__amount-unit">P</span>
                </div>
              </div>
              <div className="ir-card__meta">
                <span>지급일 {fmtDate(it.createdAt)}</span>
                {it.requester && <span>· 지급자 {it.requester.name}</span>}
              </div>
              {it.note && <p className="ir-card__note">{it.note}</p>}
            </article>
          ))}
        </div>
      )}

      <style jsx>{`
        /* ── 레이아웃 ── */
        .ir-wrap {
          max-width: 720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── 헤더 ── */
        .ir-header {
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
        .ir-header__eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #71717a;
          margin-bottom: 6px;
        }
        .ir-header__title {
          font-size: 22px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }
        .ir-header__desc {
          margin-top: 6px;
          font-size: 13px;
          color: #71717a;
          line-height: 1.6;
        }
        .ir-refresh-btn {
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
        .ir-refresh-btn:hover { background: #f4f4f5; border-color: #a1a1aa; }
        .ir-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── 검색 ── */
        .ir-search-row {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 10px;
          padding: 0 14px;
          height: 42px;
        }
        .ir-search-icon { color: #a1a1aa; flex-shrink: 0; }
        .ir-search-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 13px;
          color: #09090b;
          background: transparent;
        }
        .ir-search-input::placeholder { color: #a1a1aa; }
        .ir-search-clear {
          border: none;
          background: none;
          color: #a1a1aa;
          cursor: pointer;
          font-size: 12px;
          padding: 0 2px;
        }
        .ir-search-clear:hover { color: #71717a; }

        /* ── KPI ── */
        .ir-kpi-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .ir-kpi {
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ir-kpi--accent {
          background: #2563eb;
          border-color: #2563eb;
        }
        .ir-kpi--accent .ir-kpi__num { color: #fff; }
        .ir-kpi--accent .ir-kpi__label { color: rgba(255,255,255,0.75); }
        .ir-kpi__num {
          font-size: 26px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .ir-kpi__label {
          font-size: 12px;
          font-weight: 600;
          color: #71717a;
        }

        /* ── 탭 ── */
        .ir-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid #e4e4e7;
          padding-bottom: 0;
        }
        .ir-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 38px;
          padding: 0 14px;
          border-radius: 8px 8px 0 0;
          border: 1px solid transparent;
          border-bottom: none;
          background: transparent;
          font-size: 13px;
          font-weight: 600;
          color: #71717a;
          cursor: pointer;
          transition: color 0.15s;
          position: relative;
          bottom: -1px;
        }
        .ir-tab:hover { color: #2563eb; }
        .ir-tab--active {
          color: #2563eb;
          background: #fff;
          border-color: #e4e4e7;
          border-bottom-color: #fff;
        }
        .ir-tab__count {
          font-size: 11px;
          font-weight: 700;
          color: #a1a1aa;
          background: #f4f4f5;
          border-radius: 20px;
          padding: 1px 7px;
          min-width: 20px;
          text-align: center;
        }
        .ir-tab--active .ir-tab__count {
          background: #2563eb;
          color: #fff;
        }

        /* ── 로딩 / 빈 상태 ── */
        .ir-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 60px 0;
          color: #71717a;
          font-size: 13px;
          font-weight: 600;
        }
        .ir-empty {
          padding: 60px 0;
          text-align: center;
          font-size: 13px;
          color: #a1a1aa;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
        }

        /* ── 카드 ── */
        .ir-list { display: flex; flex-direction: column; gap: 8px; }
        .ir-card {
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 14px;
          padding: 20px 24px;
          transition: border-color 0.15s;
        }
        .ir-card__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .ir-card__who {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ir-card__name {
          font-size: 15px;
          font-weight: 800;
          color: #09090b;
          letter-spacing: -0.02em;
        }
        .ir-card__username {
          font-size: 12px;
          color: #a1a1aa;
          font-weight: 500;
        }
        .ir-card__amount {
          font-size: 22px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.04em;
          white-space: nowrap;
          line-height: 1;
        }
        .ir-card__amount-unit {
          font-size: 14px;
          font-weight: 700;
          margin-left: 2px;
          color: #71717a;
        }
        .ir-card__meta {
          margin-top: 8px;
          font-size: 12px;
          color: #a1a1aa;
          font-weight: 500;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .ir-card__note {
          margin-top: 10px;
          font-size: 13px;
          color: #52525b;
          padding: 10px 14px;
          background: #fafafa;
          border: 1px solid #f4f4f5;
          border-radius: 8px;
          line-height: 1.5;
        }

        /* ── 반응형 ── */
        @media (max-width: 600px) {
          .ir-header { padding: 18px 20px; }
          .ir-card { padding: 16px 18px; }
          .ir-kpi-row { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .ir-kpi { padding: 12px 14px; }
          .ir-kpi__num { font-size: 22px; }
        }
      `}</style>
    </main>
  );
}
