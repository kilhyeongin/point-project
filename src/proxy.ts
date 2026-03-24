import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  const isScanPage = request.nextUrl.pathname.startsWith("/partner/scan");
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
