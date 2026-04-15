"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const TABS = [
  { label: "포인트 정산", href: "points" },
  { label: "일반 정산", href: "general" },
  { label: "정산내역", href: "history" },
] as const;

export default function SettlementsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const orgSlug = params?.orgSlug as string;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {TABS.map((tab) => {
          const href = `/${orgSlug}/partner/settlements/${tab.href}`;
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
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
