"use client";

import { Home, Heart, QrCode, Clock, Settings, Coins } from "lucide-react";
import BusinessFooter from "@/components/BusinessFooter";
import { useRouter } from "next/navigation";

type Category = { code: string; name: string };

const NAV_ITEMS = [
  { icon: Home, label: "둘러보기" },
  { icon: QrCode, label: "결제 QR" },
  { icon: Clock, label: "내역" },
  { icon: Heart, label: "관심업체" },
  { icon: Settings, label: "설정" },
];

export default function LandingClient({ categories }: { categories: Category[] }) {
  const router = useRouter();

  function goLogin() {
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header
        className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl"
        style={{ boxShadow: "0 1px 0 oklch(0.918 0.008 250), 0 2px 12px -4px oklch(0 0 0 / 0.06)" }}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.52 0.27 264)" }}>
              <span className="text-white text-xs font-black">P</span>
            </div>
            <span className="text-sm font-black text-foreground tracking-tight">포인트</span>
          </div>
          <button
            type="button"
            onClick={goLogin}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <span>로그인</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">

        <div className="space-y-5">
          {/* Balance Card */}
          <div
            className="relative rounded-2xl px-5 py-4 text-white overflow-hidden cursor-pointer"
            style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}
            onClick={goLogin}
          >
            <div
              className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-15 pointer-events-none"
              style={{ background: "radial-gradient(circle, white, transparent 70%)", transform: "translate(30%, -30%)" }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Coins className="w-3.5 h-3.5 opacity-75" />
                <span className="text-xs font-semibold opacity-75">내 보유 포인트</span>
              </div>
              <div className="font-black leading-none text-white/60 text-sm">
                로그인 후 확인할 수 있어요
              </div>
            </div>
          </div>

          {/* Category Grid */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-foreground">카테고리</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((cat) => (
                <button
                  key={cat.code}
                  type="button"
                  onClick={goLogin}
                  className="flex flex-col items-center justify-center h-20 sm:h-28 rounded-xl sm:rounded-2xl gap-1 bg-muted/60 hover:bg-muted active:scale-95 transition-all duration-150 w-full"
                >
                  <span className="text-sm font-bold text-foreground">{cat.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <BusinessFooter />
      </main>

      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl"
        style={{ boxShadow: "0 -1px 0 oklch(0.918 0.008 250), 0 -4px 16px -4px oklch(0 0 0 / 0.06)" }}
      >
        <div className="max-w-2xl mx-auto flex items-stretch h-16">
          {NAV_ITEMS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={goLogin}
              className="flex flex-col items-center justify-center gap-1 flex-1 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
