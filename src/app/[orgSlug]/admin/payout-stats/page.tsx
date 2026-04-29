"use client";

import { useMemo, useState } from "react";
import { formatUsername } from "@/lib/utils";

type Item = {
  partnerId: string;
  username: string;
  name: string;
  status: string;
  issueCount: number;
  issueTotal: number;
  avgIssue: number;
  lastIssuedAt: string | null;
};

function format(n: number) {
  return Number(n || 0).toLocaleString();
}

function formatDate(v: string | null) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "-";
  }
}

function getTodayYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getMonthStartYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function PayoutStatsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [searched, setSearched] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sortType, setSortType] = useState<"amount" | "count">("amount");

  async function fetchData(start: string, end: string) {
    setLoading(true);
    setMsg("");
    setSearched(true);
    try {
      if ((start && !end) || (!start && end)) {
        setMsg("시작일과 종료일을 모두 선택하거나 둘 다 비워두세요.");
        setItems([]);
        return;
      }
      if (start && end && new Date(start) > new Date(end)) {
        setMsg("시작일은 종료일보다 늦을 수 없습니다.");
        setItems([]);
        return;
      }
      const params = new URLSearchParams();
      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);
      const res = await fetch(`/api/admin/payout-stats?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMsg(data?.message ?? "조회 실패");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setMsg("네트워크 오류");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function load() {
    fetchData(startDate, endDate);
  }

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    let list = items;
    if (q) {
      list = list.filter(
        (item) =>
          String(item.name ?? "").toLowerCase().includes(q) ||
          String(item.username ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortType === "amount") {
        return b.issueTotal !== a.issueTotal ? b.issueTotal - a.issueTotal : b.issueCount - a.issueCount;
      }
      return b.issueCount !== a.issueCount ? b.issueCount - a.issueCount : b.issueTotal - a.issueTotal;
    });
  }, [items, keyword, sortType]);

  const summary = useMemo(() => ({
    totalPartners: filteredItems.length,
    activePartners: filteredItems.filter((i) => i.issueCount > 0).length,
    totalIssueCount: filteredItems.reduce((s, i) => s + i.issueCount, 0),
    totalIssueAmount: filteredItems.reduce((s, i) => s + i.issueTotal, 0),
  }), [filteredItems]);

  return (
    <main className="space-y-5">
      {/* 헤더 + 필터 */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">포인트 지급 현황</h1>
          <p className="text-sm text-muted-foreground mt-1">
            관리자가 제휴사에 충전 승인한 포인트 건수 및 금액을 기간별로 확인합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-muted-foreground">제휴사 검색</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="제휴사명 / 아이디"
              className="w-full h-9 px-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">정렬</label>
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as "amount" | "count")}
              className="h-9 px-3 rounded-xl border border-border text-sm bg-background focus:outline-none"
            >
              <option value="amount">지급 금액순</option>
              <option value="count">지급 건수순</option>
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={load}
              className="h-9 px-4 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-80 transition-opacity"
            >
              조회
            </button>
            <button
              type="button"
              onClick={() => { setStartDate(getMonthStartYmd()); setEndDate(getTodayYmd()); }}
              className="h-9 px-4 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-colors"
            >
              이번 달
            </button>
            <button
              type="button"
              onClick={() => { setStartDate(""); setEndDate(""); setKeyword(""); setItems([]); setSearched(false); setMsg(""); }}
              className="h-9 px-4 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-colors"
            >
              전체 기간
            </button>
          </div>
        </div>

        {msg && (
          <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-bold">
            {msg}
          </div>
        )}
      </section>

      {!searched && (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          필터를 입력하고 조회 버튼을 눌러주세요.
        </div>
      )}

      {searched && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "조회 제휴사", value: `${format(summary.totalPartners)}개` },
              { label: "지급 발생 제휴사", value: `${format(summary.activePartners)}개` },
              { label: "총 지급 건수", value: `${format(summary.totalIssueCount)}건` },
              { label: "총 지급 포인트", value: `${format(summary.totalIssueAmount)}P`, highlight: true },
            ].map((card) => (
              <div key={card.label} className="bg-card border border-border rounded-2xl p-4">
                <div className="text-xs font-bold text-muted-foreground mb-2">{card.label}</div>
                <div className={`text-2xl font-black ${card.highlight ? "text-primary" : "text-foreground"}`}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* 결과 */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-bold text-muted-foreground mb-4">
              {startDate && endDate ? `${startDate} ~ ${endDate}` : "전체 기간"}
              {keyword.trim() ? ` · 검색: ${keyword}` : ""}
              {" · "}
              {sortType === "amount" ? "지급 금액순" : "지급 건수순"}
            </p>

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : (
              <>
                {/* 데스크탑 테이블 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2.5 px-3 text-xs font-black text-muted-foreground">제휴사</th>
                        <th className="text-left py-2.5 px-3 text-xs font-black text-muted-foreground">아이디</th>
                        <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">지급 건수</th>
                        <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">지급 합계</th>
                        <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">평균 지급</th>
                        <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">마지막 지급일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((it) => (
                        <tr key={it.partnerId} className="border-b border-border/50">
                          <td className="py-3 px-3 font-black text-foreground">{it.name}</td>
                          <td className="py-3 px-3 text-muted-foreground text-sm">{formatUsername(it.username)}</td>
                          <td className="py-3 px-3 text-right font-semibold">{format(it.issueCount)}건</td>
                          <td className="py-3 px-3 text-right font-black text-primary">{format(it.issueTotal)}P</td>
                          <td className="py-3 px-3 text-right font-semibold">{format(it.avgIssue)}P</td>
                          <td className="py-3 px-3 text-right text-xs text-muted-foreground">{formatDate(it.lastIssuedAt)}</td>
                        </tr>
                      ))}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                            데이터가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 모바일 카드 */}
                <div className="flex md:hidden flex-col gap-3">
                  {filteredItems.map((it) => (
                    <article key={it.partnerId} className="border border-border rounded-2xl p-4 space-y-3">
                      <div>
                        <div className="font-black text-foreground">{it.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatUsername(it.username)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {[
                          { label: "지급 건수", value: `${format(it.issueCount)}건` },
                          { label: "지급 합계", value: `${format(it.issueTotal)}P`, highlight: true },
                          { label: "평균 지급", value: `${format(it.avgIssue)}P` },
                          { label: "마지막 지급일", value: formatDate(it.lastIssuedAt) },
                        ].map((row) => (
                          <div key={row.label} className="border-t border-border/50 pt-2.5">
                            <div className="text-xs font-bold text-muted-foreground mb-1">{row.label}</div>
                            <div className={`text-sm font-black ${"highlight" in row && row.highlight ? "text-primary" : "text-foreground"}`}>
                              {row.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
                      데이터가 없습니다.
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
