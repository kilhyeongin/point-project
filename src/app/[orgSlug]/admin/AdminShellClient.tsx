"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Shield, Settings, Menu, X, ChevronDown, ChevronRight } from "lucide-react";
import { initAuthInterceptor, onSessionExpired } from "@/lib/clientFetch";
import { Toaster } from "sonner";

type SessionInfo = {
  uid: string;
  username: string;
  name: string;
  role: "ADMIN";
};

type Props = {
  session: SessionInfo;
  children: ReactNode;
};

type MenuGroup = {
  key: string;
  label: string;
  items: { href: string; label: string }[];
};

export default function AdminShellClient({ session, children }: Props) {
  const pathname = usePathname();
  const orgSlug = pathname.split('/')[1];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const MENU_GROUPS: MenuGroup[] = [
    {
      key: "dashboard",
      label: "대시보드",
      items: [
        { href: `/${orgSlug}/admin`, label: "대시보드" },
      ],
    },
    {
      key: "partner",
      label: "제휴사 관리",
      items: [
        { href: `/${orgSlug}/admin/partner-stats`, label: "제휴사 현황" },
        { href: `/${orgSlug}/admin/accounts`, label: "제휴사 계정관리" },
        { href: `/${orgSlug}/admin/settlements/partners`, label: "제휴사 정산관리" },
        { href: `/${orgSlug}/admin/partner-approvals`, label: "제휴사 승인" },
      ],
    },
    {
      key: "finance",
      label: "제휴사 포인트 관리",
      items: [
        { href: `/${orgSlug}/admin/partner-points`, label: "제휴사 포인트 충전·차감" },
        { href: `/${orgSlug}/admin/customer-points`, label: "고객 포인트 관리" },
        { href: `/${orgSlug}/admin/payout-stats`, label: "포인트 지급 현황" },
        { href: `/${orgSlug}/admin/ledger`, label: "전체 내역" },
      ],
    },
    {
      key: "manage",
      label: "설정·관리",
      items: [
        { href: `/${orgSlug}/admin/partner-categories`, label: "카테고리 관리" },
      ],
    },
  ];

  useEffect(() => {
    initAuthInterceptor();
    return onSessionExpired(() => {
      window.location.href = `/${orgSlug}/login?expired=1`;
    });
  }, [orgSlug]);

  // 드로어 열릴 때 현재 활성 그룹 자동 펼치기
  useEffect(() => {
    if (drawerOpen) {
      const activeGroupKey = getActiveGroupKey();
      setExpandedGroups(new Set([activeGroupKey]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  // 페이지 이동 시 드로어 닫기
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // 드로어 열릴 때 스크롤 잠금
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  function isActive(href: string) {
    if (href === `/${orgSlug}/admin`) return pathname === `/${orgSlug}/admin`;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function getActiveGroupKey() {
    for (const group of MENU_GROUPS) {
      for (const item of group.items) {
        if (isActive(item.href)) return group.key;
      }
    }
    return "ops";
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const activeGroupKey = getActiveGroupKey();
  const activeGroup = MENU_GROUPS.find((g) => g.key === activeGroupKey) ?? MENU_GROUPS[0];

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = `/${orgSlug}/login`;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />

      {/* ════════════════════════════════════════
          DESKTOP LAYOUT (lg+)
      ════════════════════════════════════════ */}
      <div className="hidden lg:block">
        {/* Sticky Header */}
        <header
          className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl"
          style={{
            boxShadow: "0 1px 0 oklch(0.918 0.008 250), 0 2px 12px -4px oklch(0 0 0 / 0.05)",
          }}
        >
          {/* Top bar */}
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
            {/* Brand */}
            <Link href={`/${orgSlug}/admin`} className="flex items-center gap-2.5 shrink-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "oklch(0.52 0.27 264)" }}
              >
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span
                className="text-foreground font-black tracking-tight"
                style={{ fontSize: "0.9375rem", letterSpacing: "-0.025em" }}
              >
                관리자 센터
              </span>
            </Link>

            {/* Group nav */}
            <nav
              className="flex-1 flex items-center gap-0.5 overflow-x-auto scrollbar-none"
              aria-label="관리자 상위 메뉴"
            >
              {MENU_GROUPS.map((group) => {
                const active = group.key === activeGroupKey;
                const firstHref = group.items[0]?.href ?? `/${orgSlug}/admin`;
                return (
                  <Link
                    key={group.key}
                    href={firstHref}
                    className={`shrink-0 px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    style={active ? { background: "oklch(0.52 0.27 264 / 0.09)" } : undefined}
                  >
                    {group.label}
                  </Link>
                );
              })}
            </nav>

            {/* User + settings + logout */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-muted-foreground hidden sm:block">
                {session.username}
              </span>
              <Link
                href={`/${orgSlug}/admin/settings`}
                className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                  pathname === `/${orgSlug}/admin/settings`
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:block">설정</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">로그아웃</span>
              </button>
            </div>
          </div>

          {/* Sub nav */}
          {activeGroup.items.length > 1 && <div style={{ borderTop: "1px solid oklch(0.918 0.008 250 / 0.6)" }}>
            <nav
              className="max-w-screen-xl mx-auto px-4 sm:px-6 flex items-center gap-0.5 h-10 overflow-x-auto scrollbar-none"
              aria-label="관리자 하위 메뉴"
            >
              {activeGroup.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`shrink-0 px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    style={active ? { background: "oklch(0.52 0.27 264 / 0.07)" } : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>}
        </header>

        {/* Desktop Content */}
        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-7">
          {children}
        </main>
      </div>

      {/* ════════════════════════════════════════
          MOBILE LAYOUT (< lg)
      ════════════════════════════════════════ */}
      <div className="lg:hidden">
        {/* Mobile Header */}
        <header
          className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl"
          style={{
            boxShadow: "0 1px 0 oklch(0.918 0.008 250), 0 2px 12px -4px oklch(0 0 0 / 0.05)",
          }}
        >
          <div className="px-4 h-14 flex items-center justify-between gap-3">
            {/* Brand */}
            <Link href={`/${orgSlug}/admin`} className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "oklch(0.52 0.27 264)" }}
              >
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-foreground font-black text-sm tracking-tight">
                관리자 센터
              </span>
            </Link>

            {/* 현재 위치 표시 */}
            <span className="flex-1 text-center text-xs font-bold text-muted-foreground truncate px-2">
              {activeGroup.label}
            </span>

            {/* 햄버거 버튼 */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-accent transition-colors"
              aria-label="메뉴 열기"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </header>

        {/* Mobile Content */}
        <main className="px-4 pt-5 pb-8">
          {children}
        </main>

        {/* ── 드로어 오버레이 ── */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-50"
            onClick={() => setDrawerOpen(false)}
            style={{ background: "rgba(0,0,0,0.45)" }}
          />
        )}

        {/* ── 드로어 패널 ── */}
        <div
          className="fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col"
          style={{
            background: "oklch(0.135 0.03 255)",
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {/* 드로어 헤더 */}
          <div className="flex items-center justify-between px-5 h-14 shrink-0 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "oklch(0.52 0.27 264)" }}
              >
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-white/90 text-sm font-black">관리자 센터</span>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              aria-label="메뉴 닫기"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          {/* 사용자 정보 */}
          <div className="px-5 py-4 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-black"
                style={{ background: "oklch(0.52 0.27 264 / 0.35)" }}
              >
                {(session.name?.charAt(0) || session.username?.charAt(0) || "A")}
              </div>
              <div className="min-w-0">
                <div className="text-white/85 text-sm font-bold truncate">{session.name || session.username}</div>
                <div className="text-white/40 text-xs truncate">{session.username}</div>
              </div>
            </div>
          </div>

          {/* 메뉴 그룹 목록 */}
          <nav className="flex-1 overflow-y-auto py-3 px-3">
            {MENU_GROUPS.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const isGroupActive = group.key === activeGroupKey;
              return (
                <div key={group.key} className="mb-1">
                  {/* 그룹 헤더 */}
                  {group.items.length === 1 ? (
                    <Link
                      href={group.items[0].href}
                      className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        isGroupActive
                          ? "text-white"
                          : "text-white/50 hover:text-white/80 hover:bg-white/6"
                      }`}
                      style={isGroupActive ? { background: "oklch(0.52 0.27 264 / 0.2)" } : undefined}
                    >
                      {group.label}
                    </Link>
                  ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      isGroupActive
                        ? "text-white"
                        : "text-white/50 hover:text-white/80 hover:bg-white/6"
                    }`}
                    style={isGroupActive ? { background: "oklch(0.52 0.27 264 / 0.2)" } : undefined}
                  >
                    <span>{group.label}</span>
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
                    }
                  </button>
                  )}

                  {/* 하위 메뉴 */}
                  {group.items.length > 1 && isExpanded && (
                    <div className="mt-0.5 ml-3 flex flex-col gap-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                              active
                                ? "text-white"
                                : "text-white/45 hover:text-white/75 hover:bg-white/6"
                            }`}
                            style={active ? { background: "oklch(0.52 0.27 264 / 0.25)" } : undefined}
                          >
                            {active && (
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: "oklch(0.72 0.2 240)" }}
                              />
                            )}
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* 설정 + 로그아웃 */}
          <div className="px-3 pb-6 pt-2 border-t border-white/8 shrink-0 flex flex-col gap-0.5">
            <Link
              href={`/${orgSlug}/admin/settings`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                pathname === `/${orgSlug}/admin/settings`
                  ? "text-white"
                  : "text-white/45 hover:text-white/75 hover:bg-white/6"
              }`}
              style={pathname === `/${orgSlug}/admin/settings` ? { background: "oklch(0.52 0.27 264 / 0.25)" } : undefined}
            >
              <Settings className="w-4 h-4 shrink-0" />
              설정
            </Link>
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
      </div>
    </div>
  );
}
