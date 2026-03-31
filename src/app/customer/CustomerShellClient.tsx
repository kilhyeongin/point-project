// src/app/customer/CustomerShellClient.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { Home, Heart, QrCode, Clock, LogOut, Settings, ArrowLeft } from "lucide-react";
import { initAuthInterceptor, onSessionExpired } from "@/lib/clientFetch";

type SessionInfo = {
  uid: string;
  username: string;
  name: string;
  role: string;
};

type Props = {
  session: SessionInfo;
  title: string;
  description?: string;
  children: ReactNode;
  backHref?: string;
  headerRight?: ReactNode;
  hideTitle?: boolean;
};

export default function CustomerShellClient({
  session,
  title,
  description,
  children,
  backHref,
  headerRight,
  hideTitle,
}: Props) {
  const pathname = usePathname();
  const displayName = session.name?.trim() || session.username || "고객";

  useEffect(() => {
    initAuthInterceptor();
    return onSessionExpired(() => {
      window.location.href = "/login?expired=1";
    });
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  const isHome = pathname === "/customer" || pathname.startsWith("/customer/category/");
  const isFavorites = pathname === "/customer/favorites";
  const isQr = pathname === "/customer/qr";
  const isHistory = pathname === "/customer/history";
  const isSettings = pathname === "/customer/settings";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header
        className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl"
        style={{
          boxShadow: "0 1px 0 oklch(0.918 0.008 250), 0 2px 12px -4px oklch(0 0 0 / 0.06)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {backHref ? (
            /* Sub-page header: back button + title + right action */
            <>
              <Link
                href={backHref}
                className="flex items-center justify-center w-9 h-9 -ml-1 rounded-xl text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <span className="text-base font-black text-foreground tracking-tight flex-1 text-center">
                {title}
              </span>
              <div className="w-9 h-9 flex items-center justify-center">
                {headerRight ?? null}
              </div>
            </>
          ) : (
            /* Default header: logo + logout */
            <>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "oklch(0.52 0.27 264)" }}
                >
                  <span className="text-white text-xs font-black">P</span>
                </div>
                <span className="text-sm font-black text-foreground tracking-tight">
                  포인트
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-muted-foreground hidden sm:block">
                  {displayName}님
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:block">로그아웃</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Page Title — only shown when not in sub-page mode and not hidden */}
      {!backHref && !hideTitle && (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-1">
          <h1
            className="text-foreground font-black"
            style={{ fontSize: "1.625rem", letterSpacing: "-0.04em" }}
          >
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">{children}</main>

      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl"
        style={{
          boxShadow: "0 -1px 0 oklch(0.918 0.008 250), 0 -4px 16px -4px oklch(0 0 0 / 0.06)",
        }}
      >
        <div className="max-w-2xl mx-auto flex items-stretch h-16">
          <Link
            href="/customer"
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all relative ${
              isHome ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isHome && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                style={{ background: "oklch(0.52 0.27 264)" }}
              />
            )}
            <Home className="w-5 h-5" />
            <span className="text-[11px] font-bold">둘러보기</span>
          </Link>

          <Link
            href="/customer/qr"
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all relative ${
              isQr ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isQr && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                style={{ background: "oklch(0.52 0.27 264)" }}
              />
            )}
            <QrCode className="w-5 h-5" />
            <span className="text-[11px] font-bold">결제 QR</span>
          </Link>

          <Link
            href="/customer/history"
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all relative ${
              isHistory ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isHistory && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                style={{ background: "oklch(0.52 0.27 264)" }}
              />
            )}
            <Clock className="w-5 h-5" />
            <span className="text-[11px] font-bold">내역</span>
          </Link>

          <Link
            href="/customer/favorites"
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all relative ${
              isFavorites ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isFavorites && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                style={{ background: "oklch(0.52 0.27 264)" }}
              />
            )}
            <Heart className="w-5 h-5" />
            <span className="text-[11px] font-bold">관심업체</span>
          </Link>

          <Link
            href="/customer/settings"
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all relative ${
              isSettings ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isSettings && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                style={{ background: "oklch(0.52 0.27 264)" }}
              />
            )}
            <Settings className="w-5 h-5" />
            <span className="text-[11px] font-bold">설정</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
