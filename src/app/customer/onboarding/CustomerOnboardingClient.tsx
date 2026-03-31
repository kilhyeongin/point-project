"use client";

import { useMemo, useState } from "react";
import { Loader2, Check } from "lucide-react";

type SessionInfo = { uid: string; username: string; name: string; role: string };
type InterestOption = { value: string; label: string };
type Props = { session: SessionInfo; initialInterests: string[]; interestOptions: InterestOption[] };

export default function CustomerOnboardingClient({ session, initialInterests, interestOptions }: Props) {
  const [selected, setSelected] = useState<string[]>(initialInterests);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const displayName = useMemo(() => session.name?.trim() || session.username || "고객", [session]);

  function toggleInterest(value: string) {
    setError("");
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function submit() {
    if (selected.length === 0) { setError("관심사를 1개 이상 선택해 주세요."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) { setError(data?.error ?? "저장에 실패했습니다."); return; }
      window.location.href = "/customer";
    } catch {
      setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header
        className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl"
        style={{ boxShadow: "0 1px 0 oklch(0.918 0.008 250)" }}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "oklch(0.52 0.27 264)" }}
          >
            <span className="text-white text-xs font-black">P</span>
          </div>
          <span className="text-sm font-black text-foreground tracking-tight">포인트</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-4 pt-8 pb-36 flex-1">
        {/* 타이틀 */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary mb-1">{displayName}님, 환영해요!</p>
          <h1 className="text-2xl font-black text-foreground tracking-tight leading-snug">
            관심 있는 카테고리를<br />선택해 주세요
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            선택한 카테고리의 제휴사를 모아서 보여드릴게요.<br />
            나중에 설정에서 언제든지 변경할 수 있어요.
          </p>
        </div>

        {/* 카테고리 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {interestOptions.map((item) => {
            const active = selected.includes(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => toggleInterest(item.value)}
                className="relative flex items-center justify-center h-16 rounded-2xl text-sm font-bold transition-all duration-150 active:scale-95"
                style={
                  active
                    ? { background: "oklch(0.52 0.27 264)", color: "white", boxShadow: "0 4px 14px oklch(0.52 0.27 264 / 0.35)" }
                    : { background: "oklch(0.97 0.003 250)", color: "oklch(0.4 0.01 250)", border: "1.5px solid oklch(0.92 0.008 250)" }
                }
              >
                {active && (
                  <span className="absolute top-2 right-2">
                    <Check className="w-3.5 h-3.5 text-white/80" />
                  </span>
                )}
                {item.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 text-sm font-semibold text-destructive">{error}</p>
        )}
      </div>

      {/* 하단 고정 버튼 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl px-4 pb-8 pt-4"
        style={{ boxShadow: "0 -1px 0 oklch(0.918 0.008 250)" }}
      >
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={submit}
            disabled={loading || selected.length === 0}
            className="w-full h-14 rounded-2xl text-base font-black text-white transition-all duration-150 disabled:opacity-40 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {selected.length > 0 && (
                  <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full">
                    {selected.length}개
                  </span>
                )}
                선택 완료
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
