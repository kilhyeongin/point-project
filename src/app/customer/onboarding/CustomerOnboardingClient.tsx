"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

type SessionInfo = {
  uid: string;
  username: string;
  name: string;
  role: string;
};

type InterestOption = {
  value: string;
  label: string;
};

type Props = {
  session: SessionInfo;
  initialInterests: string[];
  interestOptions: InterestOption[];
};

export default function CustomerOnboardingClient({
  session,
  initialInterests,
  interestOptions,
}: Props) {
  const [selected, setSelected] = useState<string[]>(initialInterests);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const displayName = useMemo(() => {
    return session.name?.trim() || session.username || "고객";
  }, [session.name, session.username]);

  function toggleInterest(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  async function submit() {
    if (selected.length === 0) {
      setError("관심사를 1개 이상 선택해 주세요.");
      setMsg("");
      return;
    }

    setLoading(true);
    setMsg("");
    setError("");

    try {
      const res = await fetch("/api/customer/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "관심사 저장에 실패했습니다.");
        return;
      }

      setMsg("관심사가 저장되었습니다.");
      window.location.href = "/customer";
    } catch {
      setError("관심사 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const selectedLabels = selected
    .map((value) => interestOptions.find((item) => item.value === value)?.label ?? value)
    .join(", ");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <span className="text-base font-black text-foreground tracking-tight">포인트</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Intro card */}
        <div className="bg-primary rounded-2xl p-6 text-primary-foreground">
          <div className="text-xs font-bold uppercase tracking-widest opacity-70 mb-3">
            관심사 설정
          </div>
          <h1 className="text-2xl font-black tracking-tight leading-tight">
            관심 있는 항목을 선택해 주세요
          </h1>
          <p className="mt-2 text-sm opacity-80 leading-relaxed">
            {displayName}님이 선택한 관심사를 바탕으로
            <br />
            맞춤 추천 제휴사를 먼저 보여드립니다.
          </p>

          {/* Selected preview */}
          <div className="mt-4 bg-white/10 rounded-xl p-3">
            <div className="text-xs font-bold opacity-70 mb-1">현재 선택</div>
            <p className="text-sm font-semibold">
              {selected.length > 0 ? selectedLabels : "아직 선택한 관심사가 없습니다."}
            </p>
          </div>
        </div>

        {/* Options grid */}
        <div className="bg-card shadow-card rounded-2xl p-5">
          <h2 className="text-base font-black text-foreground mb-4">관심사 선택</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {interestOptions.map((item) => {
              const active = selected.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => toggleInterest(item.value)}
                  className={`relative flex flex-col items-center justify-center min-h-[80px] rounded-2xl border-2 font-bold text-sm transition-all cursor-pointer ${
                    active
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  {active && (
                    <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
              {error}
            </div>
          )}

          {msg && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
              {msg}
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              onClick={submit}
              disabled={loading}
              className="h-11 px-6 font-bold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중...
                </span>
              ) : (
                "선택 완료"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
