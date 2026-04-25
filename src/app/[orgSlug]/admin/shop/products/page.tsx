"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ShoppingBag, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  brand: string;
  description: string;
  pointCost: number;
  imageUrl: string;
  smartconProductCode: string;
  expirationDays: number;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_FORM = {
  id: "",
  name: "",
  brand: "",
  description: "",
  pointCost: 0,
  imageUrl: "",
  smartconProductCode: "",
  expirationDays: 90,
  isActive: true,
  sortOrder: 0,
};

function formatPoint(value: number) {
  return Number(value || 0).toLocaleString();
}

export default function AdminShopProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/shop/products", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      brand: product.brand,
      description: product.description,
      pointCost: product.pointCost,
      imageUrl: product.imageUrl,
      smartconProductCode: product.smartconProductCode,
      expirationDays: product.expirationDays,
      isActive: product.isActive,
      sortOrder: product.sortOrder,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("상품명을 입력하세요."); return; }
    if (!form.brand.trim()) { toast.error("브랜드를 입력하세요."); return; }
    if (!form.pointCost || form.pointCost < 1) { toast.error("포인트 금액을 입력하세요."); return; }

    setSaving(true);
    try {
      const isEdit = Boolean(form.id);
      const url = isEdit ? `/api/admin/shop/products/${form.id}` : "/api/admin/shop/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data?.ok) {
        toast.success(isEdit ? "상품이 수정되었습니다." : "상품이 등록되었습니다.");
        setShowForm(false);
        load();
      } else {
        toast.error(data?.error ?? "저장 실패");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    if (!confirm("스마트콘 상품 목록을 동기화합니다.\n기존 상품은 유지되고 신규 상품이 추가됩니다.")) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/shop/sync", { method: "POST" });
      const data = await res.json();
      if (data?.ok) {
        toast.success(data.message ?? "동기화 완료");
        load();
      } else {
        toast.error(data?.error ?? "동기화 실패");
      }
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 상품을 삭제하시겠습니까?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/shop/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data?.ok) {
        toast.success("상품이 삭제되었습니다.");
        load();
      } else {
        toast.error(data?.error ?? "삭제 실패");
      }
    } finally {
      setDeleting(null);
    }
  }

  async function toggleActive(product: Product) {
    try {
      const res = await fetch(`/api/admin/shop/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const data = await res.json();
      if (data?.ok) {
        setItems((prev) =>
          prev.map((p) => p.id === product.id ? { ...p, isActive: !p.isActive } : p)
        );
        toast.success(product.isActive ? "상품을 비활성화했습니다." : "상품을 활성화했습니다.");
      } else {
        toast.error(data?.error ?? "변경 실패");
      }
    } catch {
      toast.error("네트워크 오류");
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-foreground">상품 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">상품몰에 노출할 상품권을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "동기화 중..." : "스마트콘 동기화"}
          </Button>
          <Button onClick={openCreate} className="gap-2 font-bold">
            <Plus className="w-4 h-4" />
            상품 등록
          </Button>
        </div>
      </div>

      {/* 상품 목록 */}
      {loading ? (
        <div className="text-center py-20 text-muted-foreground">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-muted-foreground">등록된 상품이 없습니다</p>
          <p className="text-sm text-muted-foreground/60 mt-1">상품 등록 버튼으로 추가하세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((product) => (
            <div
              key={product.id}
              className={`flex items-center gap-4 bg-card border rounded-2xl p-4 transition-all ${
                product.isActive ? "border-border" : "border-border/50 opacity-60"
              }`}
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-7 h-7 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-foreground">{product.name}</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">
                    {product.brand}
                  </span>
                  {!product.isActive && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      비활성
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-black text-primary">{formatPoint(product.pointCost)}P</span>
                  <span className="text-xs text-muted-foreground">유효 {product.expirationDays}일</span>
                  {product.smartconProductCode && (
                    <span className="text-xs text-muted-foreground">
                      코드: {product.smartconProductCode}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => toggleActive(product)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={product.isActive ? "비활성화" : "활성화"}
                >
                  {product.isActive ? (
                    <ToggleRight className="w-6 h-6 text-primary" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(product)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(product.id, product.name)}
                  disabled={deleting === product.id}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-background rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-foreground mb-5">
              {form.id ? "상품 수정" : "상품 등록"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">상품명 *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: 네이버페이 5만원권"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">브랜드 *</label>
                <input
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="예: 네이버페이"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">포인트 금액 *</label>
                <input
                  type="number"
                  value={form.pointCost || ""}
                  onChange={(e) => setForm((f) => ({ ...f, pointCost: Number(e.target.value) }))}
                  placeholder="50000"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">스마트콘 상품 코드</label>
                <input
                  value={form.smartconProductCode}
                  onChange={(e) => setForm((f) => ({ ...f, smartconProductCode: e.target.value }))}
                  placeholder="스마트콘 API 연동 후 입력"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">이미지 URL</label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">유효기간 (일)</label>
                  <input
                    type="number"
                    value={form.expirationDays}
                    onChange={(e) => setForm((f) => ({ ...f, expirationDays: Number(e.target.value) }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">정렬 순서</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">설명</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold text-foreground">즉시 노출 (활성)</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl font-bold"
              >
                취소
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl font-bold"
              >
                {saving ? "저장 중..." : form.id ? "수정" : "등록"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
