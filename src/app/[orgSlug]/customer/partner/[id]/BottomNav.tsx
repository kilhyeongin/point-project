"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, QrCode, Clock, Settings } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const orgSlug = pathname.split('/')[1];

  const NAV_ITEMS = [
    { href: `/${orgSlug}/customer`, icon: Home, label: "둘러보기" },
    { href: `/${orgSlug}/customer/qr`, icon: QrCode, label: "결제 QR" },
    { href: `/${orgSlug}/customer/history`, icon: Clock, label: "내역" },
    { href: `/${orgSlug}/customer/favorites`, icon: Heart, label: "관심업체" },
    { href: `/${orgSlug}/customer/settings`, icon: Settings, label: "설정" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl"
      style={{ boxShadow: "0 -1px 0 oklch(0.918 0.008 250), 0 -4px 16px -4px oklch(0 0 0 / 0.06)" }}
    >
      <div className="max-w-2xl mx-auto flex items-stretch h-16">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-1 flex-1 transition-all text-muted-foreground hover:text-foreground"
          >
            <Icon className="w-5 h-5" />
            <span className="text-[11px] font-bold">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
