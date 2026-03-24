"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Item = {
  partnerId: string;
  username: string;
  name: string;
  likedCount: number;
  appliedCount: number;
  issueCount: number;
  issueTotal: number;
  useCount: number;
  useTotal: number;
};

function format(n: number) {
  return Number(n || 0).toLocaleString();
}

export default function PartnerStatsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/partner-stats", {
        cache: "no-store",
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main className="space-y-5">
      {/* 헤더 */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex justify-between gap-3 flex-wrap items-center">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              제휴사 운영 현황
            </h1>
            <div className="mt-2 text-muted-foreground leading-relaxed text-sm">
              제휴사별 고객 상태 및 포인트 흐름을 확인합니다.
            </div>
          </div>

          <Button onClick={fetchData} type="button">
            새로고침
          </Button>
        </div>
      </section>

      {/* 테이블 */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : (
          <>
            {/* 데스크탑 테이블 */}
            <div className="hidden md:block overflow-x-auto -webkit-overflow-scrolling-touch">
              <div className="min-w-[900px] border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[160px_160px_120px_120px_120px_160px_120px_160px] px-3 py-3 bg-muted/50 text-xs font-black text-muted-foreground">
                  <div>제휴사</div>
                  <div>아이디</div>
                  <div>잠재고객</div>
                  <div>신청고객</div>
                  <div>지급 건수</div>
                  <div>지급 합계</div>
                  <div>차감 건수</div>
                  <div>차감 합계</div>
                </div>

                {items.map((it) => (
                  <div
                    key={it.partnerId}
                    className="grid grid-cols-[160px_160px_120px_120px_120px_160px_120px_160px] px-3 py-3 border-t border-border text-sm items-center"
                  >
                    <div>{it.name}</div>
                    <div>{it.username}</div>
                    <div>{it.likedCount}</div>
                    <div>{it.appliedCount}</div>
                    <div>{it.issueCount}</div>
                    <div className="font-black">{format(it.issueTotal)}P</div>
                    <div>{it.useCount}</div>
                    <div className="font-black">{format(it.useTotal)}P</div>
                  </div>
                ))}

                {items.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    데이터가 없습니다.
                  </div>
                ) : null}
              </div>
            </div>

            {/* 모바일 카드 */}
            <div className="flex md:hidden flex-col gap-3">
              {items.map((it) => (
                <article
                  key={it.partnerId}
                  className="border border-border rounded-2xl p-4 bg-card space-y-3"
                >
                  <div>
                    <div className="text-lg font-black text-foreground">{it.name}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{it.username}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                      <span className="text-muted-foreground font-bold">잠재고객</span>
                      <span className="font-black text-foreground">{it.likedCount}명</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                      <span className="text-muted-foreground font-bold">신청고객</span>
                      <span className="font-black text-foreground">{it.appliedCount}명</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                      <span className="text-muted-foreground font-bold">지급 건수</span>
                      <span className="font-black text-foreground">{it.issueCount}건</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                      <span className="text-muted-foreground font-bold">지급 합계</span>
                      <span className="font-black text-foreground">{format(it.issueTotal)}P</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                      <span className="text-muted-foreground font-bold">차감 건수</span>
                      <span className="font-black text-foreground">{it.useCount}건</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                      <span className="text-muted-foreground font-bold">차감 합계</span>
                      <span className="font-black text-foreground">{format(it.useTotal)}P</span>
                    </div>
                  </div>
                </article>
              ))}
              {items.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  데이터가 없습니다.
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
