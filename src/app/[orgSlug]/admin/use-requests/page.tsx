"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Check, X } from "lucide-react";
import { formatUsername } from "@/lib/utils";

type Item = {
  id: string;
  status: string;
  amount: number;
  note?: string;
  createdAt: string;
  to: { username: string; name: string } | null;
  requester: { username: string; name: string } | null;
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

export default function UseRequestsPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("PENDING");

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((i) => i.status === "PENDING").length,
    approved: items.filter((i) => i.status === "APPROVED").length,
    rejected: items.filter((i) => i.status === "REJECTED").length,
  }), [items]);

  const filtered = useMemo(() => {
    const list = tab === "ALL" ? items : items.filter((i) => i.status === tab);
    return [...list].sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (b.status === "PENDING" && a.status !== "PENDING") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, tab]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/use-requests");
      const data = await res.json();
      if (!res.ok) { toast.error(data?.message ?? "목록 조회 실패"); return; }
      setItems(data.items || []);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setWorkingKey(`${id}-${action}`);
    try {
      const res = await fetch(`/api/admin/use-requests/${id}/decide`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.message ?? "처리 실패"); return; }
      toast.success(action === "APPROVE" ? "사용 요청을 승인했습니다." : "사용 요청을 거절했습니다.");
      await load(true);
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setWorkingKey(null);
    }
  }

  useEffect(() => { load(); }, []);

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "PENDING",  label: "대기 중",  count: counts.pending },
    { key: "ALL",      label: "전체",    count: counts.all },
    { key: "APPROVED", label: "승인완료", count: counts.approved },
    { key: "REJECTED", label: "거절",    count: counts.rejected },
  ];

  return (
    <main className="ur-wrap">

      {/* ── 헤더 ── */}
      <header className="ur-header">
        <div className="ur-header__left">
          <p className="ur-header__eyebrow">포인트 관리</p>
          <h1 className="ur-header__title">사용 요청 승인</h1>
          <p className="ur-header__desc">
            고객의 포인트 사용 요청을 검토하고 승인합니다. 승인 시에만 잔액에서 차감됩니다.
          </p>
        </div>
        <button onClick={() => load()} disabled={loading} className="ur-refresh-btn">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </header>

      {/* ── KPI ── */}
      <div className="ur-kpi-row">
        <div className="ur-kpi">
          <span className="ur-kpi__num">{counts.all}</span>
          <span className="ur-kpi__label">전체 요청</span>
        </div>
        <div className="ur-kpi ur-kpi--accent">
          <span className="ur-kpi__num">{counts.pending}</span>
          <span className="ur-kpi__label">대기 중</span>
        </div>
        <div className="ur-kpi">
          <span className="ur-kpi__num">{counts.approved}</span>
          <span className="ur-kpi__label">승인완료</span>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="ur-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`ur-tab ${tab === t.key ? "ur-tab--active" : ""}`}
          >
            {t.label}
            <span className="ur-tab__count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── 목록 ── */}
      {loading ? (
        <div className="ur-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>불러오는 중</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ur-empty">
          {tab === "PENDING" ? "대기 중인 사용 요청이 없습니다." : "해당 조건의 요청이 없습니다."}
        </div>
      ) : (
        <div className="ur-list">
          {filtered.map((it) => (
            <article
              key={it.id}
              className={`ur-card ${it.status === "PENDING" ? "ur-card--pending" : ""}`}
            >
              <div className="ur-card__top">
                <div className="ur-card__who">
                  <span className="ur-card__name">{it.to?.name ?? "-"}</span>
                  <span className="ur-card__username">
                    {it.to ? formatUsername(it.to.username) : "-"}
                  </span>
                  <StatusBadge status={it.status} />
                </div>
                <div className="ur-card__amount">
                  {fmt(it.amount)}<span className="ur-card__amount-unit">P</span>
                </div>
              </div>
              <div className="ur-card__meta">
                <span>요청일 {fmtDate(it.createdAt)}</span>
                {it.requester && <span>· 요청자 {it.requester.name}</span>}
              </div>
              {it.note && <p className="ur-card__note">{it.note}</p>}
              {it.status === "PENDING" && (
                <div className="ur-card__action">
                  <button
                    onClick={() => decide(it.id, "REJECT")}
                    disabled={!!workingKey}
                    className="ur-reject-btn"
                  >
                    {workingKey === `${it.id}-REJECT` ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />처리 중</>
                    ) : (
                      <><X className="w-3.5 h-3.5" />거절</>
                    )}
                  </button>
                  <button
                    onClick={() => decide(it.id, "APPROVE")}
                    disabled={!!workingKey}
                    className="ur-approve-btn"
                  >
                    {workingKey === `${it.id}-APPROVE` ? (
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

      <style jsx>{`
        /* ── 레이아웃 ── */
        .ur-wrap {
          max-width: 720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── 헤더 ── */
        .ur-header {
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
        .ur-header__eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #71717a;
          margin-bottom: 6px;
        }
        .ur-header__title {
          font-size: 22px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }
        .ur-header__desc {
          margin-top: 6px;
          font-size: 13px;
          color: #71717a;
          line-height: 1.6;
        }
        .ur-refresh-btn {
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
        .ur-refresh-btn:hover { background: #f4f4f5; border-color: #a1a1aa; }
        .ur-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── KPI ── */
        .ur-kpi-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .ur-kpi {
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ur-kpi--accent {
          background: #2563eb;
          border-color: #2563eb;
        }
        .ur-kpi--accent .ur-kpi__num { color: #fff; }
        .ur-kpi--accent .ur-kpi__label { color: rgba(255,255,255,0.75); }
        .ur-kpi__num {
          font-size: 26px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .ur-kpi__label {
          font-size: 12px;
          font-weight: 600;
          color: #71717a;
        }

        /* ── 탭 ── */
        .ur-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid #e4e4e7;
          padding-bottom: 0;
        }
        .ur-tab {
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
        .ur-tab:hover { color: #2563eb; }
        .ur-tab--active {
          color: #2563eb;
          background: #fff;
          border-color: #e4e4e7;
          border-bottom-color: #fff;
        }
        .ur-tab__count {
          font-size: 11px;
          font-weight: 700;
          color: #a1a1aa;
          background: #f4f4f5;
          border-radius: 20px;
          padding: 1px 7px;
          min-width: 20px;
          text-align: center;
        }
        .ur-tab--active .ur-tab__count {
          background: #2563eb;
          color: #fff;
        }

        /* ── 로딩 / 빈 상태 ── */
        .ur-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 60px 0;
          color: #71717a;
          font-size: 13px;
          font-weight: 600;
        }
        .ur-empty {
          padding: 60px 0;
          text-align: center;
          font-size: 13px;
          color: #a1a1aa;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
        }

        /* ── 카드 ── */
        .ur-list { display: flex; flex-direction: column; gap: 8px; }
        .ur-card {
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 14px;
          padding: 20px 24px;
          transition: border-color 0.15s;
        }
        .ur-card--pending {
          border-left: 3px solid #2563eb;
        }
        .ur-card__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .ur-card__who {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ur-card__name {
          font-size: 15px;
          font-weight: 800;
          color: #09090b;
          letter-spacing: -0.02em;
        }
        .ur-card__username {
          font-size: 12px;
          color: #a1a1aa;
          font-weight: 500;
        }
        .ur-card__amount {
          font-size: 22px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.04em;
          white-space: nowrap;
          line-height: 1;
        }
        .ur-card__amount-unit {
          font-size: 14px;
          font-weight: 700;
          margin-left: 2px;
          color: #71717a;
        }
        .ur-card__meta {
          margin-top: 8px;
          font-size: 12px;
          color: #a1a1aa;
          font-weight: 500;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .ur-card__note {
          margin-top: 10px;
          font-size: 13px;
          color: #52525b;
          padding: 10px 14px;
          background: #fafafa;
          border: 1px solid #f4f4f5;
          border-radius: 8px;
          line-height: 1.5;
        }
        .ur-card__action {
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 14px;
          border-top: 1px solid #f4f4f5;
        }
        .ur-approve-btn {
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
        .ur-approve-btn:hover { opacity: 0.85; }
        .ur-approve-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ur-reject-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 38px;
          padding: 0 16px;
          border-radius: 8px;
          border: 1px solid #e4e4e7;
          background: #fff;
          color: #71717a;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .ur-reject-btn:hover { border-color: #fca5a5; color: #dc2626; }
        .ur-reject-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── 반응형 ── */
        @media (max-width: 600px) {
          .ur-header { padding: 18px 20px; }
          .ur-card { padding: 16px 18px; }
          .ur-kpi-row { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .ur-kpi { padding: 12px 14px; }
          .ur-kpi__num { font-size: 22px; }
        }
      `}</style>
    </main>
  );
}
