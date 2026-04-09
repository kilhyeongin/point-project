"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "요청 실패");
        return;
      }

      setSent(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[400px] space-y-8">
        <Link
          href={`/${orgSlug}/login`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          로그인으로 돌아가기
        </Link>

        {sent ? (
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
                이메일을 확인해 주세요
              </h2>
              <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
                <strong>{email}</strong>로 비밀번호 재설정 링크를 보냈습니다.<br />
                링크는 <strong>15분간</strong> 유효합니다.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              이메일이 오지 않으면 스팸 폴더를 확인해 주세요.
            </p>
          </div>
        ) : (
          <>
            <div>
              <h2
                className="text-foreground font-black"
                style={{ fontSize: "1.875rem", letterSpacing: "-0.04em" }}
              >
                비밀번호 찾기
              </h2>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                가입 시 사용한 아이디와 이메일이 일치하면<br />
                비밀번호 재설정 링크를 보내드립니다.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">아이디</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="가입한 아이디"
                  required
                  autoComplete="username"
                  className="h-12 text-[15px] bg-card border-border/60"
                  style={{ boxShadow: "0 1px 4px -1px oklch(0 0 0 / 0.06)" }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">이메일</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="가입한 이메일 주소"
                  required
                  autoComplete="email"
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
                    전송 중...
                  </span>
                ) : (
                  "재설정 링크 보내기"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
