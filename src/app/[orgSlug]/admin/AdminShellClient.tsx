"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Shield, Settings } from "lucide-react";
import { initAuthInterceptor, onSessionExpired } from "@/lib/clientFetch";

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

  const MENU_GROUPS: MenuGroup[] = [
    {
      key: "ops",
      label: "대시보드",
      items: [
        { href: `/${orgSlug}/admin`, label: "대시보드" },
        { href: `/${orgSlug}/admin/accounts`, label: "계정 잔액" },
        { href: `/${orgSlug}/admin/partner-stats`, label: "제휴사 현황" },
        { href: `/${orgSlug}/admin/partner-approvals`, label: "제휴사 승인" },
      ],
    },
    {
      key: "finance",
      label: "거래·정산",
      items: [
        { href: `/${orgSlug}/admin/settlements`, label: "거래처 정산관리" },
        { href: `/${orgSlug}/admin/settlements/partners`, label: "일반 정산 관리" },
        { href: `/${orgSlug}/admin/payout-stats`, label: "포인트 현황" },
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

  const activeGroupKey = getActiveGroupKey();
  const activeGroup =
    MENU_GROUPS.find((g) => g.key === activeGroupKey) ?? MENU_GROUPS[0];

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = `/${orgSlug}/login`;
    }
  }

  return (
    <div className="min-h-screen bg-background">
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
          <div className="flex items-center gap-2.5 shrink-0">
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
          </div>

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
                  style={
                    active
                      ? { background: "oklch(0.52 0.27 264 / 0.09)" }
                      : undefined
                  }
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
        <div
          style={{ borderTop: "1px solid oklch(0.918 0.008 250 / 0.6)" }}
        >
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
                  style={
                    active
                      ? { background: "oklch(0.52 0.27 264 / 0.07)" }
                      : undefined
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-7">
        {children}
      </main>
    </div>
  );
}
