"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { FileText, ClipboardList } from "lucide-react";

const TABS = [
  { label: "거래처 수수료 정산서", href: "general", icon: FileText },
  { label: "정산내역", href: "history", icon: ClipboardList },
] as const;

export default function SettlementsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  return (
    <div className="space-y-5">
      {/* Sub-tab navigation */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => {
          const href = `/${orgSlug}/partner/settlements/${tab.href}`;
          const isActive = pathname.startsWith(href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? "text-white shadow-sm"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
              }`}
              style={isActive ? { background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" } : undefined}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
