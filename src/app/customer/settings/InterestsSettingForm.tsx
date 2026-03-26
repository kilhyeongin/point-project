"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    if (selected.length === 0) {
      setMsg("관심사를 1개 이상 선택해 주세요.");
      setIsError(true);
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/customer/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "저장하지 못했습니다.");
        setIsError(true);
        return;
      }
      setMsg("관심사가 저장되었습니다.");
      setIsError(false);
    } catch {
      setMsg("네트워크 오류가 발생했습니다.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              "px-4 h-9 rounded-full text-sm font-bold border transition-all",
              selected.includes(opt.value)
                ? "bg-primary text-white border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {msg && (
        <p className={cn("text-sm font-semibold", isError ? "text-destructive" : "text-primary")}>
          {msg}
        </p>
      )}

      <Button onClick={save} disabled={saving} className="h-11 px-6">
        {saving ? "저장 중..." : "저장"}
      </Button>
    </div>
  );
}
