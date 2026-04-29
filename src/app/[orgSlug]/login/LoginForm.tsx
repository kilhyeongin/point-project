"use client";

import { useState, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const SOCIAL_ERROR_MESSAGES: Record<string, string> = {
  naver_denied: "네이버 로그인을 취소했습니다.",
  naver_state: "보안 검증에 실패했습니다. 다시 시도해 주세요.",
  naver_token: "네이버 인증에 실패했습니다. 다시 시도해 주세요.",
  naver_profile: "네이버 프로필 조회에 실패했습니다.",
  naver_email_exists: "이미 이메일로 가입된 계정이 있습니다. 이메일로 로그인해 주세요.",
  naver_phone_exists: "이미 가입된 계정이 있습니다. 이메일로 로그인해 주세요.",
  kakao_denied: "카카오 로그인을 취소했습니다.",
  kakao_state: "보안 검증에 실패했습니다. 다시 시도해 주세요.",
  kakao_token: "카카오 인증에 실패했습니다. 다시 시도해 주세요.",
  kakao_profile: "카카오 프로필 조회에 실패했습니다.",
  kakao_email_exists: "이미 이메일로 가입된 계정이 있습니다. 이메일로 로그인해 주세요.",
  kakao_phone_exists: "이미 가입된 계정이 있습니다. 이메일로 로그인해 주세요.",
  blocked: "차단된 계정입니다. 관리자에게 문의해 주세요.",
  server: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

function LoginFormInner() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];
  const searchParams = useSearchParams();
  const isExpired = searchParams.get("expired") === "1";
  const socialError = searchParams.get("error");
  const isRegistered = searchParams.get("registered") === "1";
  const isPartnerRegistered = searchParams.get("partner_registered") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, orgSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message ?? "로그인 실패");
        return;
      }
      window.location.href = "/";
    } catch {
      setMsg("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
      {/* ── Left panel: Brand hero ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[520px] shrink-0 p-12 relative overflow-y-auto"
        style={{
          background: "linear-gradient(150deg, oklch(0.18 0.06 265) 0%, oklch(0.12 0.04 265) 100%)",
        }}
      >
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.52 0.27 264 / 0.5), transparent),
              radial-gradient(ellipse 60% 50% at 100% 100%, oklch(0.42 0.22 280 / 0.3), transparent)`,
          }}
        />
        {/* Floating circles */}
        <div
          className="absolute top-24 right-8 w-64 h-64 rounded-full opacity-8"
          style={{
            background: "radial-gradient(circle, oklch(0.52 0.27 264 / 0.2), transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-32 left-0 w-80 h-80 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, oklch(0.62 0.22 240 / 0.25), transparent 70%)",
          }}
        />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "oklch(0.52 0.27 264)" }}
            >
              <span className="text-white text-sm font-black">P</span>
            </div>
            <span className="text-white/90 text-sm font-bold tracking-wide">
              포인트 관리 시스템
            </span>
          </div>
        </div>

        {/* Main message */}
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-white/50 text-sm font-semibold uppercase tracking-widest mb-4">
              Partner Point Platform
            </p>
            <h1
              className="text-white font-black leading-tight"
              style={{ fontSize: "clamp(2rem, 3vw, 2.75rem)", letterSpacing: "-0.04em" }}
            >
              제휴사와 고객을<br />
              하나로 연결하는<br />
              <span style={{ color: "oklch(0.72 0.2 240)" }}>포인트 플랫폼</span>
            </h1>
          </div>

          <div className="flex flex-col gap-3">
            {[
              "실시간 포인트 적립 · 사용 관리",
              "제휴사 매출 정산 자동화",
              "고객 관심사 기반 추천 시스템",
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "oklch(0.52 0.27 264)" }}
                />
                <span className="text-white/60 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom copy */}
        <p className="relative z-10 text-white/25 text-xs">
          © 2026 Point Management System
        </p>
      </div>

      {/* ── Right panel: Login form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center w-full">
        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "oklch(0.52 0.27 264)" }}
          >
            <span className="text-white text-xs font-black">P</span>
          </div>
          <span className="text-foreground font-bold text-sm">포인트 관리 시스템</span>
        </div>

        <div className="w-full max-w-[400px] space-y-8">
          {/* Heading */}
          <div>
            <h2
              className="text-foreground font-black"
              style={{ fontSize: "1.875rem", letterSpacing: "-0.04em" }}
            >
              로그인
            </h2>
            <p className="text-muted-foreground text-sm mt-2">
              계속하려면 계정 정보를 입력해 주세요
            </p>
          </div>

          {/* 회원가입 완료 배너 */}
          {isRegistered && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
              <span className="text-base leading-none">✓</span>
              회원가입이 완료되었습니다. 로그인해 주세요.
            </div>
          )}
          {isPartnerRegistered && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
              <span className="text-base leading-none">✓</span>
              제휴사 가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.
            </div>
          )}

          {/* Session expired banner */}
          {isExpired && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-medium">
              <span className="text-base leading-none">⏱</span>
              세션이 만료되었습니다. 다시 로그인해 주세요.
            </div>
          )}

          {/* Social login error banner */}
          {socialError && SOCIAL_ERROR_MESSAGES[socialError] && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-medium">
              <span className="text-base leading-none">⚠</span>
              {SOCIAL_ERROR_MESSAGES[socialError]}
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">아이디</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디 입력"
                required
                autoComplete="username"
                className="h-12 text-[15px] bg-card border-border/60"
                style={{ boxShadow: "0 1px 4px -1px oklch(0 0 0 / 0.06)" }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">비밀번호</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="비밀번호 입력"
                required
                autoComplete="current-password"
                className="h-12 text-[15px] bg-card border-border/60"
                style={{ boxShadow: "0 1px 4px -1px oklch(0 0 0 / 0.06)" }}
              />
            </div>

            {msg && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-medium">
                <span className="text-base leading-none">⚠</span>
                {msg}
              </div>
            )}

            <Button
              disabled={loading}
              type="submit"
              className="w-full h-12 text-[15px] font-bold mt-1 shadow-primary"
              style={{
                background: "oklch(0.52 0.27 264)",
                borderRadius: "0.75rem",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  로그인 중...
                </span>
              ) : (
                "로그인"
              )}
            </Button>
          </form>

          {/* Forgot password */}
          <div className="text-right -mt-2">
            <a
              href={`/${orgSlug}/forgot-password`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              비밀번호를 잊으셨나요?
            </a>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">또는</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Social login */}
          <div className="flex flex-col gap-3">
            <a
              href={`/api/auth/naver?orgSlug=${orgSlug}`}
              className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl font-bold text-[15px] text-white transition-opacity hover:opacity-90 active:opacity-80"
              style={{ background: "#03C75A" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
              </svg>
              네이버로 로그인
            </a>
            <a
              href={`/api/auth/kakao?orgSlug=${orgSlug}`}
              className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl font-bold text-[15px] transition-opacity hover:opacity-90 active:opacity-80"
              style={{ background: "#FEE500", color: "#191919" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919" aria-hidden="true">
                <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.612 5.074 4.063 6.518L5.07 21l4.382-2.88C10.237 18.37 11.1 18.5 12 18.5c5.523 0 10-3.477 10-7.7S17.523 3 12 3z" />
              </svg>
              카카오로 로그인
            </a>
          </div>

          {/* Signup */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              아직 계정이 없으신가요?{" "}
              <a
                href={`/${orgSlug}/signup`}
                className="font-bold underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-all"
                style={{ color: "oklch(0.52 0.27 264)" }}
              >
                회원가입
              </a>
            </p>
          </div>

        </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<LoginFormInner />}>
      <LoginFormInner />
    </Suspense>
  );
}
