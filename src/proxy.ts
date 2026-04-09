import { type NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const MUTATION_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const CRON_PATHS = ["/api/admin/settlements/auto-close"];
const CSRF_BYPASS_PATHS = ["/api/auth/logout", "/api/platform/setup", "/api/platform/organizations"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── CSRF: API 변경 요청의 Origin 검증 ──────────────────────────
  const isBypassPath = CSRF_BYPASS_PATHS.some((p) => pathname === p);
  if (!isBypassPath && pathname.startsWith("/api/") && MUTATION_METHODS.includes(method)) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    if (origin && !origin.startsWith(APP_URL)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (!origin && referer && !referer.startsWith(APP_URL)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const isCronPath = CRON_PATHS.some((p) => pathname === p);
    if (!origin && !referer && !isCronPath) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  // ── 보안 헤더 ──────────────────────────────────────────────────
  const response = NextResponse.next({ request });

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  const isScanPage = pathname.includes("/partner/scan");
  response.headers.set(
    "Permissions-Policy",
    isScanPage
      ? "camera=(self), microphone=(), geolocation=()"
      : "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
