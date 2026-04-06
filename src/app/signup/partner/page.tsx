"use client";

import Link from "next/link";
import Script from "next/script";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    daum: {
      Postcode: new (config: { oncomplete: (data: DaumPostcodeResult) => void }) => { open: () => void };
    };
  }
}

interface DaumPostcodeResult {
  roadAddress: string;
  jibunAddress: string;
}

export default function PartnerSignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    businessName: "",
    businessNumber: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    username: "",
    password: "",
    passwordConfirm: "",
    address: "",
    detailAddress: "",
  });

  // 사업자등록번호 인증
  const [checkingBusiness, setCheckingBusiness] = useState(false);
  const [businessCheckMsg, setBusinessCheckMsg] = useState("");
  const [businessChecked, setBusinessChecked] = useState(false);

  function formatBusinessNumber(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  async function checkBusinessNumber() {
    setBusinessCheckMsg("");
    setBusinessChecked(false);

    if (!form.businessNumber) {
      setBusinessCheckMsg("사업자등록번호를 입력해 주세요.");
      return;
    }

    setCheckingBusiness(true);
    try {
      const res = await fetch("/api/signup/check-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessNumber: form.businessNumber, businessName: form.businessName }),
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setBusinessCheckMsg(data?.error ?? "확인에 실패했습니다.");
        setBusinessChecked(false);
      } else {
        setBusinessCheckMsg(data.message ?? "사업자 확인이 완료되었습니다.");
        setBusinessChecked(true);
      }
    } catch {
      setBusinessCheckMsg("네트워크 오류");
    } finally {
      setCheckingBusiness(false);
    }
  }

  const [msg, setMsg] = useState("");

  // 개인정보 동의
  const [consent, setConsent] = useState({ terms: false, privacy: false });
  const [expandedConsent, setExpandedConsent] = useState<string | null>(null);
  const allConsented = consent.terms && consent.privacy;

  function toggleAll(checked: boolean) {
    setConsent({ terms: checked, privacy: checked });
  }
  const [saving, setSaving] = useState(false);

  // 아이디 중복확인
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameCheckMsg, setUsernameCheckMsg] = useState("");
  const [usernameChecked, setUsernameChecked] = useState(false);

  // 비밀번호 확인
  const passwordMatch =
    form.passwordConfirm.length > 0 && form.password === form.passwordConfirm;
  const passwordMismatch =
    form.passwordConfirm.length > 0 && form.password !== form.passwordConfirm;

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.startsWith("02")) {
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
      if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  async function checkUsername() {
    setUsernameCheckMsg("");
    setUsernameChecked(false);

    if (!form.username) {
      setUsernameCheckMsg("아이디를 입력해 주세요.");
      return;
    }

    setCheckingUsername(true);
    try {
      const res = await fetch("/api/signup/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username }),
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setUsernameCheckMsg(data?.error ?? "확인에 실패했습니다.");
        setUsernameChecked(false);
      } else {
        setUsernameCheckMsg(data.message ?? "사용 가능한 아이디입니다.");
        setUsernameChecked(true);
      }
    } catch {
      setUsernameCheckMsg("네트워크 오류");
    } finally {
      setCheckingUsername(false);
    }
  }

  function openAddressSearch() {
    if (!window.daum?.Postcode) {
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete(data) {
        const addr = data.roadAddress || data.jibunAddress;
        setForm((prev) => ({ ...prev, address: addr, detailAddress: "" }));
      },
    }).open();
  }

  async function submit() {
    if (!businessChecked) {
      setMsg("사업자등록번호 인증을 완료해 주세요.");
      return;
    }
    if (!usernameChecked) {
      setMsg("아이디 중복확인을 완료해 주세요.");
      return;
    }
    if (passwordMismatch || !form.password) {
      setMsg("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (!allConsented) {
      setMsg("필수 약관에 모두 동의해 주세요.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/signup/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "회원가입에 실패했습니다.");
        return;
      }

      alert("제휴사 가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.");
      router.push("/login");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="afterInteractive"
      />

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[520px] shrink-0 p-12 relative overflow-hidden h-screen"
        style={{ background: "linear-gradient(150deg, oklch(0.18 0.06 265) 0%, oklch(0.12 0.04 265) 100%)" }}
      >
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.52 0.27 264 / 0.5), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, oklch(0.42 0.22 280 / 0.3), transparent)` }} />
        <div className="absolute top-24 right-8 w-64 h-64 rounded-full opacity-8" style={{ background: "radial-gradient(circle, oklch(0.52 0.27 264 / 0.2), transparent 70%)" }} />
        <div className="absolute bottom-32 left-0 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, oklch(0.62 0.22 240 / 0.25), transparent 70%)" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.52 0.27 264)" }}>
              <span className="text-white text-sm font-black">P</span>
            </div>
            <span className="text-white/90 text-sm font-bold tracking-wide">포인트 관리 시스템</span>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-white/50 text-sm font-semibold uppercase tracking-widest mb-4">Partner Point Platform</p>
            <h1 className="text-white font-black leading-tight" style={{ fontSize: "clamp(2rem, 3vw, 2.75rem)", letterSpacing: "-0.04em" }}>
              제휴사와 고객을<br />하나로 연결하는<br />
              <span style={{ color: "oklch(0.72 0.2 240)" }}>포인트 플랫폼</span>
            </h1>
          </div>
          <div className="flex flex-col gap-3">
            {["실시간 포인트 적립 · 사용 관리", "제휴사 매출 정산 자동화", "고객 관심사 기반 추천 시스템"].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "oklch(0.52 0.27 264)" }} />
                <span className="text-white/60 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-white/25 text-xs">© 2026 Point Management System</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center p-6 py-10 bg-background overflow-y-auto">
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.52 0.27 264)" }}>
            <span className="text-white text-xs font-black">P</span>
          </div>
          <span className="text-foreground font-bold text-sm">포인트 관리 시스템</span>
        </div>

        <div className="w-full max-w-[420px] space-y-6 py-8">

          <div>
            <h2 className="text-foreground font-black" style={{ fontSize: "1.875rem", letterSpacing: "-0.04em" }}>제휴사 가입</h2>
            <p className="text-muted-foreground text-sm mt-2">업체 등록 후 관리자 승인, 고객 연결 및 혜택 운영</p>
          </div>

        {/* Card */}
        <div className="bg-card rounded-3xl p-7 shadow-elevated space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            제휴사는 가입 후 승인대기 상태로 등록되며, 관리자 승인 후 이용할 수 있습니다.
          </p>

          <div className="space-y-4">

            {/* 업체명 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">업체명</label>
              <Input
                placeholder="업체명을 입력해 주세요"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="h-12 text-base"
              />
            </div>

            {/* 사업자등록번호 + 인증 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">사업자등록번호</label>
              <div className="flex gap-2">
                <Input
                  placeholder="000-00-00000"
                  value={form.businessNumber}
                  onChange={(e) => {
                    setForm({ ...form, businessNumber: formatBusinessNumber(e.target.value) });
                    setBusinessChecked(false);
                    setBusinessCheckMsg("");
                  }}
                  inputMode="numeric"
                  className="h-12 text-base"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={checkBusinessNumber}
                  disabled={checkingBusiness}
                  className="h-12 px-4 font-bold text-sm whitespace-nowrap shrink-0"
                >
                  {checkingBusiness ? "확인 중..." : "인증"}
                </Button>
              </div>
              {businessCheckMsg && (
                <p className={`text-sm font-semibold mt-1 ${businessChecked ? "text-green-700" : "text-destructive"}`}>
                  {businessCheckMsg}
                </p>
              )}
            </div>

            {/* 담당자명 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">담당자명</label>
              <Input
                placeholder="홍길동"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="h-12 text-base"
              />
            </div>

            {/* 담당자 전화번호 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">담당자 전화번호</label>
              <Input
                placeholder="010-0000-0000"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: formatPhone(e.target.value) })}
                inputMode="numeric"
                className="h-12 text-base"
              />
            </div>

            {/* 이메일 (알림 수신용) */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">
                이메일 (알림 수신용) <span className="font-normal text-muted-foreground">(선택)</span>
              </label>
              <Input
                type="email"
                placeholder="example@company.com"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                className="h-12 text-base"
              />
            </div>

            {/* 아이디 + 중복확인 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">아이디</label>
              <div className="flex gap-2">
                <Input
                  placeholder="영문 소문자, 숫자 4자 이상"
                  value={form.username}
                  onChange={(e) => {
                    setForm({ ...form, username: e.target.value });
                    setUsernameChecked(false);
                    setUsernameCheckMsg("");
                  }}
                  className="h-12 text-base"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={checkUsername}
                  disabled={checkingUsername}
                  className="h-12 px-4 font-bold text-sm whitespace-nowrap shrink-0"
                >
                  {checkingUsername ? "확인 중..." : "중복확인"}
                </Button>
              </div>
              {usernameCheckMsg && (
                <p className={`text-sm font-semibold mt-1 ${usernameChecked ? "text-green-700" : "text-destructive"}`}>
                  {usernameCheckMsg}
                </p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">비밀번호</label>
              <Input
                type="password"
                placeholder="8자 이상"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-12 text-base"
              />
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">비밀번호 확인</label>
              <Input
                type="password"
                placeholder="비밀번호 재입력"
                value={form.passwordConfirm}
                onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                className="h-12 text-base"
              />
              {passwordMatch && (
                <p className="text-sm font-semibold text-green-700 mt-1">✓ 비밀번호가 일치합니다.</p>
              )}
              {passwordMismatch && (
                <p className="text-sm font-semibold text-destructive mt-1">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            {/* 업체 주소 + 주소검색 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">업체 주소</label>
              <div className="flex gap-2">
                <Input
                  placeholder="주소 검색을 이용해 주세요"
                  value={form.address}
                  readOnly
                  className={`h-12 text-base cursor-default ${!form.address ? "bg-muted" : ""}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={openAddressSearch}
                  className="h-12 px-4 font-bold text-sm whitespace-nowrap shrink-0"
                >
                  주소검색
                </Button>
              </div>
            </div>

            {/* 상세주소 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">
                상세주소 <span className="font-normal text-muted-foreground">(선택)</span>
              </label>
              <Input
                placeholder="상세주소 입력"
                value={form.detailAddress}
                onChange={(e) => setForm({ ...form, detailAddress: e.target.value })}
                className="h-12 text-base"
              />
            </div>

          </div>

          {/* 개인정보 동의 */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* 전체 동의 */}
            <label className="flex items-center gap-3 px-4 py-3 bg-muted/40 cursor-pointer select-none border-b border-border">
              <input
                type="checkbox"
                checked={allConsented}
                onChange={(e) => toggleAll(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-black text-foreground">약관 전체 동의</span>
            </label>

            {/* 이용약관 */}
            <div className="border-b border-border">
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={consent.terms}
                  onChange={(e) => setConsent(p => ({ ...p, terms: e.target.checked }))}
                  className="w-4 h-4 accent-primary shrink-0"
                />
                <span className="text-sm text-foreground flex-1">
                  <span className="text-destructive font-bold">[필수]</span> 서비스 이용약관 동의
                </span>
                <button type="button" onClick={() => setExpandedConsent(expandedConsent === "terms" ? null : "terms")} className="text-xs text-muted-foreground hover:text-foreground shrink-0">
                  {expandedConsent === "terms" ? "접기" : "보기"}
                </button>
              </div>
              {expandedConsent === "terms" && (
                <div className="mx-4 mb-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground leading-relaxed max-h-32 overflow-y-auto">
                  본 서비스는 포인트 적립 및 고객 예약 관리를 제공합니다. 제휴사는 서비스 이용 규칙을 준수해야 하며, 허위 정보 등록이나 부정한 포인트 운용은 금지됩니다. 운영자는 사전 공지 후 서비스 내용을 변경하거나 종료할 수 있습니다.
                </div>
              )}
            </div>

            {/* 개인정보 수집·이용 */}
            <div>
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={consent.privacy}
                  onChange={(e) => setConsent(p => ({ ...p, privacy: e.target.checked }))}
                  className="w-4 h-4 accent-primary shrink-0"
                />
                <span className="text-sm text-foreground flex-1">
                  <span className="text-destructive font-bold">[필수]</span> 개인정보 수집·이용 동의
                </span>
                <button type="button" onClick={() => setExpandedConsent(expandedConsent === "privacy" ? null : "privacy")} className="text-xs text-muted-foreground hover:text-foreground shrink-0">
                  {expandedConsent === "privacy" ? "접기" : "보기"}
                </button>
              </div>
              {expandedConsent === "privacy" && (
                <div className="mx-4 mb-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground leading-relaxed max-h-32 overflow-y-auto">
                  <strong className="text-foreground">수집 항목:</strong> 상호명, 사업자등록번호, 담당자명, 연락처, 이메일, 업체 주소<br />
                  <strong className="text-foreground">수집 목적:</strong> 제휴사 서비스 제공, 본인 확인, 정산 처리<br />
                  <strong className="text-foreground">보유 기간:</strong> 회원 탈퇴 시까지 (법령에 따라 일부 항목은 최대 5년 보관)<br />
                  동의를 거부할 권리가 있으나, 거부 시 서비스 이용이 제한될 수 있습니다.
                </div>
              )}
            </div>
          </div>

          {/* Error message */}
          {msg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
              <span className="shrink-0">⚠</span>
              {msg}
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button
              onClick={submit}
              disabled={saving}
              className="h-12 text-base font-bold flex-1"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  가입 중...
                </span>
              ) : (
                "회원가입"
              )}
            </Button>
            <Link
              href="/signup"
              className={cn(buttonVariants({ variant: "outline" }), "h-12 px-6 text-base font-bold")}
            >
              이전
            </Link>
          </div>

        </div>

        {/* Login link */}
        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            로그인
          </Link>
        </p>

        </div>
      </div>
    </div>
  );
}
