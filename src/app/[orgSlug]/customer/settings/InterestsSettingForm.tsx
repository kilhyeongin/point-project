"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Sparkles } from "lucide-react";

type Option = { value: string; label: string };

export default function InterestsSettingForm() {
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
    setSaved(false);
    setErrorMsg("");
  }

  async function save() {
    if (selected.length === 0) {
      setErrorMsg("관심사를 1개 이상 선택해 주세요.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/customer/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error ?? "저장하지 못했습니다.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 안내 카드 */}
      <div
        className="rounded-2xl px-5 py-4 flex items-start gap-3"
        style={{ background: "oklch(0.96 0.015 264)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "oklch(0.52 0.27 264)" }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-foreground mb-0.5">맞춤 제휴사 추천</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            관심 분야를 선택하면 메인 화면에 맞춤 카테고리와 제휴사를 보여드립니다.
          </p>
        </div>
      </div>

      {/* 선택 카운터 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-black text-foreground">카테고리 선택</span>
        <span
          className="px-3 py-1 rounded-full text-xs font-black text-white"
          style={{
            background: selected.length > 0
              ? "oklch(0.52 0.27 264)"
              : "oklch(0.75 0.01 250)",
          }}
        >
          {selected.length}개 선택
        </span>
      </div>

      {/* 카테고리 그리드 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="relative flex items-center justify-center h-16 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-95"
                style={
                  isSelected
                    ? {
                        background: "oklch(0.52 0.27 264)",
                        color: "white",
                        boxShadow: "0 6px 16px oklch(0.52 0.27 264 / 0.35)",
                      }
                    : {
                        background: "oklch(0.97 0.004 250)",
                        color: "oklch(0.45 0.01 250)",
                        border: "1.5px solid oklch(0.91 0.008 250)",
                      }
                }
              >
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5">
                    <Check className="w-3.5 h-3.5 text-white/80" strokeWidth={3} />
                  </span>
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 에러 메시지 */}
      {errorMsg && (
        <div className="px-4 py-3 rounded-xl text-sm font-semibold bg-destructive/8 border border-destructive/20 text-destructive">
          {errorMsg}
        </div>
      )}

      {/* 저장 버튼 */}
      <button
        type="button"
        onClick={save}
        disabled={saving || selected.length === 0}
        className="w-full h-13 rounded-2xl text-sm font-black text-white transition-all duration-200 disabled:opacity-40 active:scale-[0.98]"
        style={{
          background: saved
            ? "linear-gradient(135deg, oklch(0.55 0.18 160) 0%, oklch(0.45 0.16 155) 100%)"
            : "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)",
          boxShadow: selected.length > 0 && !saving
            ? "0 4px 16px oklch(0.52 0.27 264 / 0.30)"
            : "none",
        }}
      >
        {saving ? "저장 중..." : saved ? "✓ 저장되었습니다" : "저장하기"}
      </button>
    </div>
  );
}
