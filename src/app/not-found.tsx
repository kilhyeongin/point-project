import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "oklch(0.96 0.015 250)" }}
        >
          <span
            className="font-black"
            style={{ fontSize: "1.75rem", color: "oklch(0.52 0.27 264)" }}
          >
            404
          </span>
        </div>
        <div>
          <h1
            className="text-foreground font-black"
            style={{ fontSize: "1.375rem", letterSpacing: "-0.03em" }}
          >
            페이지를 찾을 수 없습니다
          </h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            요청하신 페이지가 존재하지 않거나 이동되었습니다.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center justify-center w-full h-11 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: "oklch(0.52 0.27 264)" }}
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
