"use client";

import { useEffect, useMemo, useState } from "react";

type UserItem = {
  id: string;
  username: string;
  name: string;
  role: "CUSTOMER" | "PARTNER" | "ADMIN";
  status: "ACTIVE" | "PENDING" | "BLOCKED";
  balance?: number;
};

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function roleLabel(role: string) {
  if (role === "PARTNER") return "제휴사";
  if (role === "CUSTOMER") return "고객";
  if (role === "ADMIN") return "총괄관리자";
  return role;
}

function statusLabel(status: string) {
  if (status === "ACTIVE") return "활성";
  if (status === "PENDING") return "대기";
  if (status === "BLOCKED") return "차단";
  return status;
}

function parseSignedNumber(v: string) {
  const cleaned = String(v || "").replace(/[^\d-]/g, "");
  if (!cleaned || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export default function AdminAdjustPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [selected, setSelected] = useState<UserItem | null>(null);
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amountNum = useMemo(() => parseSignedNumber(amountText), [amountText]);

  async function loadUsers() {
    setLoading(true);
    setMsg("");

    try {
      const sp = new URLSearchParams();
      sp.set("role", "ALL");
      if (q.trim()) sp.set("q", q.trim());

      const res = await fetch(`/api/admin/users/search?${sp.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setItems([]);
        setMsg(data?.message ?? "대상 사용자 조회 실패");
        return;
      }

      const nextItems = data.items ?? [];
      setItems(nextItems);

      if (selected) {
        const freshSelected = nextItems.find((u: UserItem) => u.id === selected.id) ?? null;
        setSelected(freshSelected);
      }
    } catch {
      setItems([]);
      setMsg("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  async function submitAdjust() {
    setMsg("");

    if (!selected) {
      setMsg("조정 대상을 먼저 선택해주세요.");
      return;
    }

    if (amountNum === 0) {
      setMsg("조정 금액은 0이 될 수 없습니다.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: selected.id,
          amount: amountNum,
          note: note.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMsg(data?.message ?? "포인트 조정 실패");
        return;
      }

      setMsg(
        `✅ ${selected.name} (${selected.username}) 계정에 ${
          amountNum > 0 ? "증액" : "차감"
        } ${formatNumber(Math.abs(amountNum))}P 조정 완료`
      );

      setAmountText("");
      setNote("");

      await loadUsers();
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <main className="page-shell">
      <style>{`
        .page-shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
          background: #f5f7fb;
          color: #111827;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .page-sub {
          margin-top: 8px;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.6;
        }

        .top-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ghost-btn,
        .solid-btn,
        .back-btn {
          min-height: 44px;
          padding: 0 14px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .ghost-btn,
        .back-btn {
          border: 1px solid #d1d5db;
          background: #fff;
          color: #111827;
        }

        .solid-btn {
          border: 1px solid #111827;
          background: #111827;
          color: #fff;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-card,
        .filter-panel,
        .section-card,
        .user-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .summary-card,
        .filter-panel,
        .section-card {
          padding: 16px;
        }

        .summary-card.primary {
          background: linear-gradient(135deg, #111827, #1f2937);
          border-color: #111827;
          color: #fff;
        }

        .summary-label {
          font-size: 13px;
          color: #6b7280;
        }

        .summary-card.primary .summary-label,
        .summary-card.primary .summary-sub {
          color: rgba(255,255,255,0.8);
        }

        .summary-value {
          margin-top: 8px;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .summary-sub {
          margin-top: 8px;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.5;
        }

        .filter-panel {
          margin-bottom: 16px;
        }

        .filter-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .input,
        .textarea {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          background: #fff;
          padding: 0 14px;
          font-size: 14px;
          outline: none;
        }

        .input {
          min-height: 46px;
          width: 100%;
        }

        .textarea {
          min-height: 120px;
          width: 100%;
          padding: 12px 14px;
          resize: none;
        }

        .message-box {
          margin-bottom: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #d1d5db;
          background: #fff;
          font-weight: 800;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 16px;
          align-items: start;
        }

        .section-title {
          margin: 0 0 10px;
          font-size: 20px;
          font-weight: 900;
        }

        .section-desc {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 14px;
        }

        .user-list {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 2px;
        }

        .user-card {
          padding: 14px;
          background: #fbfcfe;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .user-card.active {
          border-color: #111827;
          box-shadow: 0 0 0 2px rgba(17,24,39,0.06);
          background: #fff;
        }

        .user-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .user-name {
          font-size: 16px;
          font-weight: 900;
        }

        .user-sub {
          margin-top: 6px;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.5;
        }

        .user-balance {
          font-size: 18px;
          font-weight: 900;
          white-space: nowrap;
        }

        .badge-row {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          color: #374151;
        }

        .badge.plus {
          background: #eef2ff;
        }

        .badge.minus {
          background: #fef2f2;
          color: #991b1b;
        }

        .field {
          display: grid;
          gap: 6px;
          margin-bottom: 12px;
        }

        .field-label {
          font-size: 13px;
          color: #6b7280;
          font-weight: 800;
        }

        .preview-box {
          margin-top: 10px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          font-size: 14px;
          line-height: 1.7;
        }

        .preview-box.minus {
          background: #fff7f7;
          border-color: #fecaca;
        }

        .preview-box.plus {
          background: #f8fafc;
        }

        .empty-box {
          padding: 18px;
          text-align: center;
          color: #6b7280;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          background: #fff;
        }

        @media (max-width: 960px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .main-grid {
            grid-template-columns: 1fr;
          }

          .user-list {
            max-height: none;
          }
        }

        @media (max-width: 760px) {
          .page-shell {
            padding: 16px;
          }

          .page-header {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-row,
          .top-actions {
            flex-direction: column;
          }

          .input,
          .ghost-btn,
          .solid-btn,
          .back-btn {
            width: 100%;
          }

          .user-top {
            flex-direction: column;
          }

          .user-balance {
            white-space: normal;
          }
        }
      `}</style>

      <header className="page-header">
        <div>
          <h1 className="page-title">관리자 포인트 조정</h1>
          <div className="page-sub">
            관리자 전용 수동 조정 화면입니다. 양수는 증액, 음수는 차감으로 기록되며
            원장에는 조정으로 저장됩니다.
          </div>
        </div>

        <div className="top-actions">
          <button onClick={loadUsers} className="ghost-btn" type="button">
            새로고침
          </button>
          <a href="/admin" className="back-btn">
            대시보드로
          </a>
        </div>
      </header>

      <section className="summary-grid">
        <div className="summary-card primary">
          <div className="summary-label">검색 대상 수</div>
          <div className="summary-value">{formatNumber(items.length)}명</div>
          <div className="summary-sub">전 역할 사용자 조회 가능</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">선택된 대상</div>
          <div className="summary-value">
            {selected ? selected.name : "-"}
          </div>
          <div className="summary-sub">
            {selected ? `${selected.username} / ${roleLabel(selected.role)}` : "대상 미선택"}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-label">조정 예정 금액</div>
          <div className="summary-value">
            {amountNum > 0 ? "+" : amountNum < 0 ? "-" : ""}
            {formatNumber(Math.abs(amountNum))}P
          </div>
          <div className="summary-sub">0은 실행 불가</div>
        </div>
      </section>

      <section className="filter-panel">
        <div className="filter-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름 또는 아이디 검색"
            className="input"
          />

          <button onClick={loadUsers} className="solid-btn" type="button">
            검색
          </button>
        </div>
      </section>

      {msg && <div className="message-box">{msg}</div>}

      <section className="main-grid">
        <section className="section-card">
          <h2 className="section-title">조정 대상 선택</h2>
          <div className="section-desc">
            고객, 제휴사, 관리자까지 전체 계정 대상 검색이 가능합니다.
          </div>

          {loading ? (
            <div className="empty-box">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="empty-box">조회된 사용자가 없습니다.</div>
          ) : (
            <div className="user-list">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={`user-card ${selected?.id === item.id ? "active" : ""}`}
                  onClick={() => setSelected(item)}
                >
                  <div className="user-top">
                    <div>
                      <div className="user-name">
                        {item.name} ({item.username})
                      </div>
                      <div className="user-sub">
                        역할: {roleLabel(item.role)} / 상태: {statusLabel(item.status)}
                      </div>
                    </div>

                    <div className="user-balance">
                      {formatNumber(item.balance ?? 0)}P
                    </div>
                  </div>

                  <div className="badge-row">
                    <span className={`badge ${amountNum < 0 ? "minus" : "plus"}`}>
                      현재 잔액
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="section-card">
          <h2 className="section-title">조정 실행</h2>
          <div className="section-desc">
            양수 입력 시 증액, 음수 입력 시 차감됩니다.
          </div>

          <div className="field">
            <label className="field-label">선택 대상</label>
            <div className={`preview-box ${amountNum < 0 ? "minus" : "plus"}`}>
              {selected ? (
                <>
                  <div>
                    <b>{selected.name}</b> ({selected.username})
                  </div>
                  <div>역할: {roleLabel(selected.role)}</div>
                  <div>상태: {statusLabel(selected.status)}</div>
                  <div>현재 잔액: {formatNumber(selected.balance ?? 0)}P</div>
                </>
              ) : (
                <div>왼쪽 목록에서 대상을 선택해주세요.</div>
              )}
            </div>
          </div>

          <div className="field">
            <label className="field-label">조정 금액</label>
            <input
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="예: 10000 또는 -5000"
              className="input"
              inputMode="numeric"
            />
          </div>

          <div className="field">
            <label className="field-label">메모</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="선택 입력"
              className="textarea"
            />
          </div>

          <div className={`preview-box ${amountNum < 0 ? "minus" : "plus"}`}>
            <div>
              조정 방향:{" "}
              <b>
                {amountNum > 0 ? "증액" : amountNum < 0 ? "차감" : "미입력"}
              </b>
            </div>
            <div>
              조정 금액:{" "}
              <b>
                {amountNum > 0 ? "+" : amountNum < 0 ? "-" : ""}
                {formatNumber(Math.abs(amountNum))}P
              </b>
            </div>
            <div>
              조정 후 예상 잔액:{" "}
              <b>{formatNumber((selected?.balance ?? 0) + amountNum)}P</b>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              onClick={submitAdjust}
              className="solid-btn"
              type="button"
              disabled={submitting}
              style={{ width: "100%" }}
            >
              {submitting ? "처리 중..." : "조정 실행"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}