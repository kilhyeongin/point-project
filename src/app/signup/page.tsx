import Link from "next/link";

export default function SignupSelectPage() {
  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Left panel: Brand hero ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[520px] shrink-0 p-12 relative overflow-hidden h-screen"
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

      {/* ── Right panel: Signup selection ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background overflow-y-auto">
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

        <div className="w-full max-w-[500px] space-y-6">
          {/* Heading */}
          <div>
            <h2
              className="text-foreground font-black"
              style={{ fontSize: "1.875rem", letterSpacing: "-0.04em" }}
            >
              회원가입
            </h2>
            <p className="text-muted-foreground text-sm mt-2">
              가입 유형을 선택해 주세요
            </p>
          </div>

          {/* Card */}
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Link
              href="/signup/customer"
              className="flex flex-col gap-2.5 rounded-2xl p-5 no-underline text-foreground bg-card shadow-card hover:shadow-card-hover transition-all duration-200"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-1 text-white text-sm font-black"
                style={{ background: "oklch(0.52 0.27 264)" }}
              >
                고
              </div>
              <strong className="text-base font-black">일반 고객 가입</strong>
              <span className="text-sm text-muted-foreground leading-relaxed">
                추천 제휴사 확인, 관심사 선택, 포인트/혜택 이용
              </span>
            </Link>

            <Link
              href="/signup/partner"
              className="flex flex-col gap-2.5 rounded-2xl p-5 no-underline text-foreground bg-card shadow-card hover:shadow-card-hover transition-all duration-200"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-1 text-white text-sm font-black"
                style={{ background: "oklch(0.42 0.22 280)" }}
              >
                파
              </div>
              <strong className="text-base font-black">제휴사 가입</strong>
              <span className="text-sm text-muted-foreground leading-relaxed">
                업체 등록 후 관리자 승인, 고객 연결 및 혜택 운영
              </span>
            </Link>
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
