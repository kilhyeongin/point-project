"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { LayoutDashboard, User, LogOut, QrCode, FileText, CalendarCheck, ClipboardList, ChevronRight, Users } from "lucide-react";
import { initAuthInterceptor, onSessionExpired } from "@/lib/clientFetch";
import { Toaster } from "sonner";

type SessionInfo = {
  uid: string;
  username: string;
  name: string;
  role: "PARTNER";
};

type Props = {
  session: SessionInfo;
  children: ReactNode;
};

export default function PartnerShellClient({ session, children }: Props) {
  const pathname = usePathname();
  const orgSlug = pathname.split('/')[1];
  const displayName = session.name?.trim() || session.username || "파트너";
  const [settlementHover, setSettlementHover] = useState(false);

  const SETTLEMENT_SUB = [
    { href: `/${orgSlug}/partner/settlements/general`, label: "거래처 수수료 정산서", icon: FileText },
    { href: `/${orgSlug}/partner/settlements/history`, label: "정산내역", icon: ClipboardList },
  ];

  const MENU_ITEMS = [
    { href: `/${orgSlug}/partner`, label: "대시보드", icon: LayoutDashboard },
    { href: `/${orgSlug}/partner/scan`, label: "QR 스캔", icon: QrCode, mobileOnly: true, hardNav: true },
    { href: `/${orgSlug}/partner/appointments`, label: "예약", icon: CalendarCheck },
    { href: `/${orgSlug}/partner/staff`, label: "직원 관리", icon: Users },
    { href: `/${orgSlug}/partner/profile`, label: "내 정보", icon: User },
    { href: `/${orgSlug}/partner/settlements`, label: "정산", icon: FileText },
  ];

  useEffect(() => {
    initAuthInterceptor();
    return onSessionExpired(() => {
      window.location.href = `/${orgSlug}/login?expired=1`;
    });
  }, [orgSlug]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = `/${orgSlug}/login`;
    }
  }

  function isActive(href: string) {
    if (href === `/${orgSlug}/partner`) return pathname === `/${orgSlug}/partner`;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster
        position="bottom-center"
        richColors
        duration={5000}
        closeButton
        toastOptions={{
          style: { fontSize: "0.875rem", fontWeight: "700", padding: "14px 16px" },
        }}
      />
      {/* ─── Desktop Layout ─── */}
      <div className="hidden lg:flex min-h-screen">
        {/* Sidebar — dark navy */}
        <aside
          className="w-[220px] shrink-0"
          style={{ background: "oklch(0.135 0.03 255)" }}
        >
          <div className="sticky top-0 h-screen flex flex-col py-5 gap-1">
            {/* Brand */}
            <div className="px-5 pb-5 mb-1 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "oklch(0.52 0.27 264)" }}
                >
                  <span className="text-white text-sm font-black">P</span>
                </div>
                <div className="min-w-0">
                  <div className="text-white/90 text-sm font-bold leading-tight truncate">
                    포인트 관리
                  </div>
                  <div className="text-white/40 text-xs truncate">제휴사</div>
                </div>
              </div>
            </div>

            {/* User info */}
            <div className="px-5 py-3 mb-1">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-black"
                  style={{ background: "oklch(0.52 0.27 264 / 0.3)" }}
                >
                  {displayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-white/85 text-sm font-bold truncate">
                    {displayName}
                  </div>
                  <div className="text-white/40 text-xs truncate">
                    {session.username}
                  </div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-0.5 flex-1 px-3">
              {MENU_ITEMS.filter(item => !item.mobileOnly).map((item) => {
                const isSettlement = item.href === `/${orgSlug}/partner/settlements`;
                const active = isActive(item.href);
                const Icon = item.icon;

                if (isSettlement) {
                  return (
                    <div
                      key={item.href}
                      onMouseEnter={() => setSettlementHover(true)}
                      onMouseLeave={() => setSettlementHover(false)}
                      className="relative"
                    >
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          active ? "text-white" : "text-white/50 hover:text-white/80 hover:bg-white/6"
                        }`}
                        style={active ? { background: "oklch(0.52 0.27 264 / 0.25)" } : undefined}
                      >
                        <Icon className="w-4 h-4 shrink-0" style={active ? { color: "oklch(0.72 0.2 240)" } : undefined} />
                        {item.label}
                        <ChevronRight className={`ml-auto w-3.5 h-3.5 transition-transform ${settlementHover ? "rotate-90" : ""}`} style={{ color: "oklch(0.72 0.2 240 / 0.5)" }} />
                      </Link>
                      {/* 서브메뉴 */}
                      {settlementHover && (
                        <div className="mt-0.5 ml-4 flex flex-col gap-0.5">
                          {SETTLEMENT_SUB.map((sub) => {
                            const subActive = pathname.startsWith(sub.href);
                            const SubIcon = sub.icon;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                  subActive ? "text-white" : "text-white/40 hover:text-white/70 hover:bg-white/6"
                                }`}
                                style={subActive ? { background: "oklch(0.52 0.27 264 / 0.2)" } : undefined}
                              >
                                <SubIcon className="w-3.5 h-3.5 shrink-0" style={subActive ? { color: "oklch(0.72 0.2 240)" } : undefined} />
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      active ? "text-white" : "text-white/50 hover:text-white/80 hover:bg-white/6"
                    }`}
                    style={active ? { background: "oklch(0.52 0.27 264 / 0.25)" } : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" style={active ? { color: "oklch(0.72 0.2 240)" } : undefined} />
                    {item.label}
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "oklch(0.52 0.27 264)" }} />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Logout */}
            <div className="px-3 pt-2 border-t border-white/8 mt-1">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-white/70 hover:bg-white/6 transition-all w-full cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                로그아웃
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-8">{children}</main>
      </div>

      {/* ─── Mobile Layout ─── */}
      <div className="lg:hidden">
        {/* Top Header */}
        <header
          className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl"
          style={{
            boxShadow: "0 1px 0 oklch(0.918 0.008 250), 0 2px 12px -4px oklch(0 0 0 / 0.06)",
          }}
        >
          <div className="px-4 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black"
                style={{ background: "oklch(0.52 0.27 264)" }}
              >
                {displayName.charAt(0)}
              </div>
              <span className="text-sm font-bold text-foreground">
                {displayName}님
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>로그아웃</span>
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="px-4 pt-4 pb-28">{children}</main>

        {/* Bottom Tab Bar */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl"
          aria-label="하단 탭 메뉴"
          style={{
            boxShadow: "0 -1px 0 oklch(0.918 0.008 250), 0 -4px 16px -4px oklch(0 0 0 / 0.06)",
          }}
        >
          <div className="flex items-stretch h-16" role="tablist">
            {MENU_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const tabClass = `flex flex-col items-center justify-center gap-1 flex-1 transition-all relative ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`;
              const inner = (
                <>
                  {active && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                      style={{ background: "oklch(0.52 0.27 264)" }}
                    />
                  )}
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] font-bold">{item.label}</span>
                </>
              );
              // QR 스캔은 하드 네비게이션 (삼성 인터넷 카메라 권한 버그 대응)
              return item.hardNav ? (
                <a key={item.href} href={item.href} className={tabClass} role="tab" aria-current={active ? "page" : undefined} aria-selected={active}>{inner}</a>
              ) : (
                <Link key={item.href} href={item.href} className={tabClass} role="tab" aria-current={active ? "page" : undefined} aria-selected={active}>{inner}</Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
