"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle } from "lucide-react";

function ResetPasswordForm() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => setValid(!!data?.valid))
      .catch(() => setValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "재설정 실패");
        return;
      }

      setDone(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || !valid) {
    return (
      <div className="space-y-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "oklch(0.97 0.012 25)" }}
        >
          <span className="text-3xl">⚠️</span>
        </div>
        <div>
          <h2
            className="text-foreground font-black"
            style={{ fontSize: "1.375rem", letterSpacing: "-0.03em" }}
          >
            링크가 만료되었습니다
          </h2>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            링크가 만료되었거나 이미 사용된 링크입니다.<br />
            비밀번호 찾기를 다시 시도해 주세요.
          </p>
        </div>
        <Link
          href={`/${orgSlug}/forgot-password`}
          className="inline-flex items-center justify-center w-full h-11 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: "oklch(0.52 0.27 264)" }}
        >
          비밀번호 찾기 다시 하기
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "oklch(0.96 0.015 145)" }}
        >
          <CheckCircle className="w-8 h-8" style={{ color: "oklch(0.45 0.2 145)" }} />
        </div>
        <div>
          <h2
            className="text-foreground font-black"
            style={{ fontSize: "1.625rem", letterSpacing: "-0.04em" }}
          >
            비밀번호가 변경되었습니다
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            새 비밀번호로 로그인해 주세요.
          </p>
        </div>
        <Link
          href={`/${orgSlug}/login`}
          className="inline-flex items-center justify-center w-full h-11 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: "oklch(0.52 0.27 264)" }}
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <>
      <div>
        <h2
          className="text-foreground font-black"
          style={{ fontSize: "1.875rem", letterSpacing: "-0.04em" }}
        >
          새 비밀번호 설정
        </h2>
        <p className="text-muted-foreground text-sm mt-2">
          새로운 비밀번호를 입력해 주세요.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">새 비밀번호</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            required
            autoComplete="new-password"
            className="h-12 text-[15px] bg-card border-border/60"
            style={{ boxShadow: "0 1px 4px -1px oklch(0 0 0 / 0.06)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">비밀번호 확인</label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="비밀번호 재입력"
            required
            autoComplete="new-password"
            className="h-12 text-[15px] bg-card border-border/60"
            style={{ boxShadow: "0 1px 4px -1px oklch(0 0 0 / 0.06)" }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-medium">
            <span className="text-base leading-none">⚠</span>
            {error}
          </div>
        )}

        <Button
          disabled={loading}
          type="submit"
          className="w-full h-12 text-[15px] font-bold mt-1"
          style={{
            background: "oklch(0.52 0.27 264)",
            borderRadius: "0.75rem",
          }}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              변경 중...
            </span>
          ) : (
            "비밀번호 변경"
          )}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[400px] space-y-8">
        <Suspense fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
