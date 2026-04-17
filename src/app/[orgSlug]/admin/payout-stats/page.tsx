"use client";

import { useMemo, useState } from "react";
import { formatUsername } from "@/lib/utils";

type Item = {
  partnerId: string;
  username: string;
  name: string;
  status: string;
  issueCount: number;
  issueTotal: number;
  avgIssue: number;
  lastIssuedAt: string | null;
};

function format(n: number) {
  return Number(n || 0).toLocaleString();
}

function formatDate(v: string | null) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return "-";
  }
}

function getTodayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthStartYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    padding: 20,
  };
}

export default function PayoutStatsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [searched, setSearched] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sortType, setSortType] = useState<"amount" | "count">("amount");

  async function fetchData(start: string, end: string) {
    setLoading(true);
    setMsg("");
    setSearched(true);

    try {
      if ((start && !end) || (!start && end)) {
        setMsg("시작일과 종료일을 모두 선택하거나 둘 다 비워두세요.");
        setItems([]);
        return;
      }

      if (start && end && new Date(start) > new Date(end)) {
        setMsg("시작일은 종료일보다 늦을 수 없습니다.");
        setItems([]);
        return;
      }

      const params = new URLSearchParams();
      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);

      const res = await fetch(`/api/admin/payout-stats?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setMsg(data?.message ?? "조회 실패");
        setItems([]);
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setMsg("네트워크 오류");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function load() {
    fetchData(startDate, endDate);
  }


  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    let list = items;

    if (q) {
      list = list.filter((item) => {
        return (
          String(item.name ?? "").toLowerCase().includes(q) ||
          String(item.username ?? "").toLowerCase().includes(q)
        );
      });
    }

    return [...list].sort((a, b) => {
      if (sortType === "amount") {
        if (b.issueTotal !== a.issueTotal) return b.issueTotal - a.issueTotal;
        return b.issueCount - a.issueCount;
      }
      if (b.issueCount !== a.issueCount) return b.issueCount - a.issueCount;
      return b.issueTotal - a.issueTotal;
    });
  }, [items, keyword, sortType]);

  const summary = useMemo(() => {
    const totalPartners = filteredItems.length;
    const activePartners = filteredItems.filter((item) => item.issueCount > 0).length;
    const totalIssueCount = filteredItems.reduce((sum, item) => sum + item.issueCount, 0);
    const totalIssueAmount = filteredItems.reduce((sum, item) => sum + item.issueTotal, 0);

    return {
      totalPartners,
      activePartners,
      totalIssueCount,
      totalIssueAmount,
    };
  }, [filteredItems]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <section style={cardStyle()}>
        <div className="payout-stats__header-row">
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>
              포인트 지급 현황
            </h1>
            <div className="payout-stats__desc">
              관리자가 제휴사에 충전 승인한 포인트 건수 및 금액을 기간별로 확인합니다.
            </div>
          </div>

          <button
            onClick={load}
            className="payout-stats__primary-btn"
            type="button"
          >
            새로고침
          </button>
        </div>

        <div className="payout-stats__filter-row">
          <div className="payout-stats__filter-group">
            <label className="payout-stats__label">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="payout-stats__input"
            />
          </div>

          <div className="payout-stats__filter-group">
            <label className="payout-stats__label">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="payout-stats__input"
            />
          </div>

          <div className="payout-stats__filter-group">
            <label className="payout-stats__label">제휴사 검색</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="제휴사명 / 아이디 검색"
              className="payout-stats__input"
            />
          </div>

          <div className="payout-stats__filter-group">
            <label className="payout-stats__label">정렬 기준</label>
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as "amount" | "count")}
              className="payout-stats__input"
            >
              <option value="amount">지급 금액순</option>
              <option value="count">지급 건수순</option>
            </select>
          </div>

          <div className="payout-stats__filter-actions">
            <button
              type="button"
              onClick={load}
              className="payout-stats__primary-btn"
            >
              조회
            </button>

            <button
              type="button"
              onClick={() => {
                setStartDate(getMonthStartYmd());
                setEndDate(getTodayYmd());
              }}
              className="payout-stats__secondary-btn"
            >
              이번 달
            </button>

            <button
              type="button"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setKeyword("");
                setItems([]);
                setSearched(false);
                setMsg("");
              }}
              className="payout-stats__secondary-btn"
            >
              전체 기간
            </button>
          </div>
        </div>

        {msg ? <div className="payout-stats__msg">{msg}</div> : null}
      </section>

      {!searched && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "#9ca3af", fontSize: 14, border: "1px dashed #e5e7eb", borderRadius: 16 }}>
          필터를 입력하고 조회 버튼을 눌러주세요.
        </div>
      )}

      {searched && <section className="payout-stats__summary-grid">
        <div style={cardStyle()}>
          <div className="payout-stats__summary-label">조회 제휴사</div>
          <div className="payout-stats__summary-value">
            {format(summary.totalPartners)}개
          </div>
        </div>

        <div style={cardStyle()}>
          <div className="payout-stats__summary-label">지급 발생 제휴사</div>
          <div className="payout-stats__summary-value">
            {format(summary.activePartners)}개
          </div>
        </div>

        <div style={cardStyle()}>
          <div className="payout-stats__summary-label">총 지급 건수</div>
          <div className="payout-stats__summary-value">
            {format(summary.totalIssueCount)}건
          </div>
        </div>

        <div style={cardStyle()}>
          <div className="payout-stats__summary-label">총 지급 포인트</div>
          <div className="payout-stats__summary-value">
            {format(summary.totalIssueAmount)}P
          </div>
        </div>
      </section>}

      {searched && <section style={cardStyle()}>
        <div className="payout-stats__meta-line">
          조회 기간: {startDate && endDate ? `${startDate} ~ ${endDate}` : "전체 기간"}
          {keyword.trim() ? ` / 검색어: ${keyword}` : ""}
          {` / 정렬: ${sortType === "amount" ? "지급 금액순" : "지급 건수순"}`}
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>불러오는 중...</div>
        ) : (
          <>
            <div className="payout-stats__table-wrap">
              <div className="payout-stats__table">
                <div className="payout-stats__thead">
                  <div>제휴사</div>
                  <div>아이디</div>
                  <div>지급 건수</div>
                  <div>지급 합계</div>
                  <div>평균 지급</div>
                  <div>마지막 지급일</div>
                </div>

                {filteredItems.map((it) => (
                  <div key={it.partnerId} className="payout-stats__row">
                    <div style={{ fontWeight: 800 }}>{it.name}</div>
                    <div>{formatUsername(it.username)}</div>
                    <div>{format(it.issueCount)}건</div>
                    <div style={{ fontWeight: 800 }}>
                      {format(it.issueTotal)}P
                    </div>
                    <div>{format(it.avgIssue)}P</div>
                    <div>{formatDate(it.lastIssuedAt)}</div>
                  </div>
                ))}

                {!loading && filteredItems.length === 0 ? (
                  <div className="payout-stats__empty">데이터가 없습니다.</div>
                ) : null}
              </div>
            </div>

            <div className="payout-stats__mobile-cards">
              {filteredItems.map((it) => (
                <article key={it.partnerId} className="payout-stats__mobile-card">
                  <div className="payout-stats__mobile-title">
                    <div className="payout-stats__mobile-name">{it.name}</div>
                    <div className="payout-stats__mobile-username">{formatUsername(it.username)}</div>
                  </div>

                  <div className="payout-stats__mobile-grid">
                    <div className="payout-stats__mobile-item">
                      <span>지급 건수</span>
                      <strong>{format(it.issueCount)}건</strong>
                    </div>

                    <div className="payout-stats__mobile-item">
                      <span>지급 합계</span>
                      <strong>{format(it.issueTotal)}P</strong>
                    </div>

                    <div className="payout-stats__mobile-item">
                      <span>평균 지급</span>
                      <strong>{format(it.avgIssue)}P</strong>
                    </div>

                    <div className="payout-stats__mobile-item">
                      <span>마지막 지급</span>
                      <strong>{formatDate(it.lastIssuedAt)}</strong>
                    </div>
                  </div>
                </article>
              ))}

              {!loading && filteredItems.length === 0 ? (
                <div className="payout-stats__empty">데이터가 없습니다.</div>
              ) : null}
            </div>
          </>
        )}
      </section>}

      <style jsx>{`
        .payout-stats__header-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }

        .payout-stats__desc {
          margin-top: 8px;
          color: #6b7280;
          line-height: 1.6;
        }

        .payout-stats__filter-row {
          margin-top: 18px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr auto;
          gap: 12px;
          align-items: end;
        }

        .payout-stats__filter-group {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .payout-stats__label {
          font-size: 13px;
          font-weight: 800;
          color: #6b7280;
        }

        .payout-stats__input {
          width: 100%;
          height: 44px;
          border-radius: 10px;
          border: 1px solid #d1d5db;
          background: #fff;
          padding: 0 12px;
          box-sizing: border-box;
          min-width: 0;
        }

        .payout-stats__filter-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .payout-stats__primary-btn {
          height: 44px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid #111827;
          background: #111827;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .payout-stats__secondary-btn {
          height: 44px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid #d1d5db;
          background: #fff;
          color: #111827;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .payout-stats__msg {
          margin-top: 12px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          font-weight: 700;
        }

        .payout-stats__summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .payout-stats__summary-label {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 8px;
          font-weight: 800;
        }

        .payout-stats__summary-value {
          font-size: 28px;
          color: #111827;
          font-weight: 900;
          line-height: 1.2;
        }

        .payout-stats__meta-line {
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 14px;
          color: #374151;
          line-height: 1.6;
          word-break: keep-all;
        }

        .payout-stats__table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .payout-stats__table {
          min-width: 980px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }

        .payout-stats__thead,
        .payout-stats__row {
          display: grid;
          grid-template-columns: 180px 180px 130px 160px 140px 220px;
          padding: 12px 14px;
          align-items: center;
          column-gap: 12px;
        }

        .payout-stats__thead {
          background: #f8fafc;
          font-size: 13px;
          font-weight: 900;
          color: #475569;
        }

        .payout-stats__row {
          border-top: 1px solid #f1f5f9;
        }

        .payout-stats__mobile-cards {
          display: none;
        }

        .payout-stats__mobile-card {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          background: #fff;
          display: grid;
          gap: 12px;
        }

        .payout-stats__mobile-title {
          display: grid;
          gap: 4px;
        }

        .payout-stats__mobile-name {
          font-size: 17px;
          font-weight: 900;
          color: #111827;
          line-height: 1.3;
        }

        .payout-stats__mobile-username {
          font-size: 14px;
          color: #6b7280;
          word-break: break-all;
        }

        .payout-stats__mobile-grid {
          display: grid;
          gap: 10px;
        }

        .payout-stats__mobile-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          padding: 10px 0;
          border-top: 1px solid #f1f5f9;
          line-height: 1.5;
        }

        .payout-stats__mobile-item:first-child {
          border-top: none;
          padding-top: 0;
        }

        .payout-stats__mobile-item span {
          color: #6b7280;
          font-size: 14px;
          font-weight: 700;
        }

        .payout-stats__mobile-item strong {
          color: #111827;
          font-size: 14px;
          font-weight: 900;
          text-align: right;
        }

        .payout-stats__empty {
          padding: 20px;
          text-align: center;
          color: #6b7280;
        }

        @media (max-width: 1400px) {
          .payout-stats__filter-row {
            grid-template-columns: 1fr 1fr 1fr;
          }

          .payout-stats__filter-actions {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 1100px) {
          .payout-stats__summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .payout-stats__filter-row {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 768px) {
          .payout-stats__table-wrap {
            display: none;
          }

          .payout-stats__mobile-cards {
            display: grid;
            gap: 12px;
          }
        }

        @media (max-width: 640px) {
          .payout-stats__summary-grid {
            grid-template-columns: 1fr;
          }

          .payout-stats__filter-row {
            grid-template-columns: 1fr;
          }

          .payout-stats__filter-actions {
            grid-column: auto;
          }

          .payout-stats__summary-value {
            font-size: 24px;
          }

          .payout-stats__primary-btn,
          .payout-stats__secondary-btn {
            width: 100%;
          }

          .payout-stats__header-row {
            align-items: stretch;
          }
        }
      `}</style>
    </main>
  );
}