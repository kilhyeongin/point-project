"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type CategoryItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  isVisibleToPartner: boolean;
  isVisibleToCustomer: boolean;
  sortOrder: number;
};

const EMPTY_FORM = {
  id: "",
  code: "",
  name: "",
  description: "",
  isActive: true,
  isVisibleToPartner: true,
  isVisibleToCustomer: true,
  sortOrder: 0,
};

export default function AdminPartnerCategoriesPage() {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [isDirtyOrder, setIsDirtyOrder] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [keyword, setKeyword] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/partner-categories", {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "카테고리 목록을 불러오지 못했습니다.");
        setItems([]);
        return;
      }

      setItems(Array.isArray(data.items) ? data.items : []);
      setIsDirtyOrder(false);
    } catch {
      setMsg("네트워크 오류");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function moveItem(index: number, direction: "up" | "down") {
    const next = [...items];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    // sortOrder를 배열 인덱스 기준으로 재부여
    const reordered = next.map((item, i) => ({ ...item, sortOrder: i }));
    setItems(reordered);
    setIsDirtyOrder(true);
  }

  async function saveOrder() {
    setSavingOrder(true);
    setMsg("");
    try {
      const orders = items.map((item) => ({ id: item.id, sortOrder: item.sortOrder }));
      const res = await fetch("/api/admin/partner-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "순서 저장 실패");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setIsDirtyOrder(false);
      setMsg("순서가 저장되었습니다.");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setSavingOrder(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function save() {
    setSaving(true);
    setMsg("");

    try {
      const targetUrl = form.id
        ? `/api/admin/partner-categories/${form.id}`
        : "/api/admin/partner-categories";

      const method = form.id ? "PUT" : "POST";

      const res = await fetch(targetUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "저장하지 못했습니다.");
        return;
      }

      setItems(Array.isArray(data.items) ? data.items : []);
      setIsDirtyOrder(false);
      setMsg(data?.message ?? "저장되었습니다.");
      resetForm();
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: CategoryItem) {
    if (!window.confirm(`"${item.name}" 카테고리를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    setDeleting(item.id);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/partner-categories/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "삭제하지 못했습니다.");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setIsDirtyOrder(false);
      setMsg(data?.message ?? "삭제되었습니다.");
      if (form.id === item.id) resetForm();
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setDeleting(null);
    }
  }

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [item.code, item.name, item.description].some((value) =>
        String(value).toLowerCase().includes(q)
      )
    );
  }, [items, keyword]);

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <style>{`
        .cat-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .cat-input {
          height: 44px;
          border-radius: 12px;
          border: 1px solid #d1d5db;
          padding: 0 12px;
          background: #fff;
          width: 100%;
          box-sizing: border-box;
        }
        .cat-search-input {
          height: 44px;
          border-radius: 12px;
          border: 1px solid #d1d5db;
          padding: 0 12px;
          background: #fff;
          width: 100%;
          max-width: 360px;
          box-sizing: border-box;
        }
        @media (max-width: 640px) {
          .cat-form-grid {
            grid-template-columns: 1fr;
          }
          .cat-search-input {
            max-width: 100%;
          }
          .cat-col-hide-mobile {
            display: none;
          }
        }
      `}</style>
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          background: "#fff",
          padding: 20,
          boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
          카테고리 관리
        </h1>
        <p style={{ marginTop: 10, color: "#4b5563", lineHeight: 1.6 }}>
          총괄 관리자가 고객/제휴사 화면에 노출할 카테고리를 직접 등록하고 제어합니다.
        </p>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          background: "#fff",
          padding: 20,
          boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900 }}>
          {form.id ? "카테고리 수정" : "카테고리 등록"}
        </div>

        <div className="cat-form-grid">
          <input
            value={form.code}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
            }
            placeholder="코드 (예: DRESS)"
            className="cat-input"
          />
          <input
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="카테고리명"
            className="cat-input"
          />
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isActive: e.target.checked }))
              }
            />{" "}
            사용
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.isVisibleToPartner}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  isVisibleToPartner: e.target.checked,
                }))
              }
            />{" "}
            제휴사 노출
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.isVisibleToCustomer}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  isVisibleToCustomer: e.target.checked,
                }))
              }
            />{" "}
            고객 노출
          </label>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={save} disabled={saving} style={primaryButton}>
            {saving ? "저장 중..." : "저장"}
          </button>
          <button onClick={resetForm} style={secondaryButton}>
            초기화
          </button>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          background: "#fff",
          padding: 20,
          boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="코드 / 이름 / 설명 검색"
            className="cat-search-input"
          />
          <div style={{ display: "flex", gap: 8 }}>
            {isDirtyOrder && (
              <button onClick={saveOrder} disabled={savingOrder} style={primaryButton}>
                {savingOrder ? "저장 중..." : "순서 저장"}
              </button>
            )}
            <button onClick={load} style={secondaryButton}>
              새로고침
            </button>
          </div>
        </div>
        {isDirtyOrder && (
          <div style={{ fontSize: 13, color: "#d97706", fontWeight: 600 }}>
            ↕ 순서가 변경되었습니다. &quot;순서 저장&quot;을 눌러 반영하세요.
          </div>
        )}

        {msg ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              fontWeight: 700,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ color: "#6b7280", fontWeight: 700 }}>
          {loading ? "불러오는 중..." : `총 ${filtered.length}개`}
        </div>

        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          <table style={{ width: "100%", minWidth: 320, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {[
                  { label: "순서", hide: false },
                  { label: "코드", hide: false },
                  { label: "카테고리명", hide: false },
                  { label: "제휴사", hide: true },
                  { label: "고객", hide: true },
                  { label: "사용", hide: true },
                  { label: "관리", hide: false },
                ].map(({ label, hide }) => (
                  <th key={label} style={thtd} className={hide ? "cat-col-hide-mobile" : ""}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => {
                const realIndex = items.findIndex((i) => i.id === item.id);
                const isFiltering = keyword.trim() !== "";
                return (
                  <tr key={item.id}>
                    <td style={{ ...thtd, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ color: "#9ca3af", fontSize: 14, minWidth: 20 }}>
                          {index + 1}
                        </span>
                        {!isFiltering && (
                          <>
                            <button
                              onClick={() => moveItem(realIndex, "up")}
                              disabled={realIndex === 0}
                              style={arrowButton}
                              title="위로"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveItem(realIndex, "down")}
                              disabled={realIndex === items.length - 1}
                              style={arrowButton}
                              title="아래로"
                            >
                              ▼
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={thtd}>{item.code}</td>
                    <td style={{ ...thtd, fontWeight: 700 }}>{item.name}</td>
                    <td style={thtd} className="cat-col-hide-mobile">{item.isVisibleToPartner ? "노출" : "숨김"}</td>
                    <td style={thtd} className="cat-col-hide-mobile">{item.isVisibleToCustomer ? "노출" : "숨김"}</td>
                    <td style={thtd} className="cat-col-hide-mobile">{item.isActive ? "사용" : "중지"}</td>
                    <td style={{ ...thtd, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setForm(item)} style={{ ...secondaryButton, height: 32, padding: "0 12px", borderRadius: 8, fontSize: 14 }}>
                          수정
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          disabled={deleting === item.id}
                          style={dangerButton}
                        >
                          {deleting === item.id ? "삭제 중..." : "삭제"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const inputStyle: CSSProperties = {
  height: 44,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  padding: "0 12px",
  background: "#fff",
};

const primaryButton: CSSProperties = {
  height: 44,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  height: 44,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButton: CSSProperties = {
  height: 32,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #ef4444",
  background: "#fff",
  color: "#ef4444",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const arrowButton: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  color: "#374151",
  fontSize: 10,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
};

const thtd: CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 12px",
  textAlign: "left",
  verticalAlign: "middle",
  fontSize: 14,
};