import Link from "next/link";

export default function SignupSelectPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[500px] space-y-6">

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <span className="text-primary-foreground text-2xl font-black">P</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">포인트 관리 시스템</h1>
            <p className="text-sm text-muted-foreground mt-1">가입 유형을 선택해 주세요</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card rounded-3xl p-7 shadow-elevated space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            일반 고객과 제휴사는 가입 정보와 가입 후 진행 흐름이 다릅니다.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 max-sm:grid-cols-1">
            <Link
              href="/signup/customer"
              className="flex flex-col gap-2.5 rounded-2xl p-5 no-underline text-foreground bg-background shadow-card hover:shadow-card-hover transition-all duration-200"
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
              className="flex flex-col gap-2.5 rounded-2xl p-5 no-underline text-foreground bg-background shadow-card hover:shadow-card-hover transition-all duration-200"
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
  );
}
