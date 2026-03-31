"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";

type Option = { value: string; label: string };

export default function InterestsSettingForm() {
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetch("/api/customer/onboarding", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          setOptions(data.interestOptions ?? []);
          setSelected(data.interests ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function toggle(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    setMsg("");
  }

  async function save() {
    if (selected.length === 0) { setMsg("관심사를 1개 이상 선택해 주세요."); setIsError(true); return; }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/customer/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) { setMsg(data?.error ?? "저장하지 못했습니다."); setIsError(true); return; }
      setMsg("저장되었습니다.");
      setIsError(false);
    } catch {
      setMsg("네트워크 오류가 발생했습니다."); setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          관심 카테고리를 선택하면 맞춤 제휴사를 보여드립니다.
        </p>
        <span className="text-xs font-black text-primary shrink-0 ml-2">{selected.length}개 선택</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="relative flex items-center justify-center h-14 rounded-2xl text-sm font-bold transition-all duration-150 active:scale-95"
              style={
                isSelected
                  ? { background: "oklch(0.52 0.27 264)", color: "white", boxShadow: "0 4px 12px oklch(0.52 0.27 264 / 0.30)" }
                  : { background: "oklch(0.97 0.003 250)", color: "oklch(0.4 0.01 250)", border: "1.5px solid oklch(0.92 0.008 250)" }
              }
            >
              {isSelected && (
                <span className="absolute top-2 right-2">
                  <Check className="w-3 h-3 text-white/80" />
                </span>
              )}
              {opt.label}
            </button>
          );
        })}
      </div>

      {msg && (
        <p className={`text-sm font-semibold ${isError ? "text-destructive" : "text-primary"}`}>
          {msg}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || selected.length === 0}
        className="w-full h-12 rounded-2xl text-sm font-black text-white transition-all duration-150 disabled:opacity-40 active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}
      >
        {saving ? "저장 중..." : "저장하기"}
      </button>
    </div>
  );
}
