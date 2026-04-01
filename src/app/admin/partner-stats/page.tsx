"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

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
  uniqueCustomers: number;
};

type MonthlyRow = {
  month: string;
  issueCount: number;
  issueTotal: number;
  useCount: number;
  useTotal: number;
};

type DetailData = {
  partner: { id: string; username: string; name: string; likedCount: number; appliedCount: number };
  summary: { issueCount: number; issueTotal: number; useCount: number; useTotal: number; uniqueCustomers: number };
  monthly: MonthlyRow[];
};

function fmt(n: number) {
  return Number(n || 0).toLocaleString();
}

function getMonthStart(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function getMonthEnd(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type Preset = "thisMonth" | "lastMonth" | "3months" | "all" | "custom";

export default function PartnerStatsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [startDate, setStartDate] = useState(getMonthStart(0));
  const [endDate, setEndDate] = useState(getToday());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortCol, setSortCol] = useState<"issueTotal" | "useTotal" | "issueCount" | "useCount" | "uniqueCustomers">("issueTotal");

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === "thisMonth") { setStartDate(getMonthStart(0)); setEndDate(getToday()); }
    else if (p === "lastMonth") { setStartDate(getMonthStart(-1)); setEndDate(getMonthEnd(-1)); }
    else if (p === "3months") { setStartDate(getMonthStart(-2)); setEndDate(getToday()); }
    else if (p === "all") { setStartDate(""); setEndDate(""); }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/admin/partner-stats?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(partnerId: string) {
    setSelectedId(partnerId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/admin/partner-stats/${partnerId}?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => b[sortCol] - a[sortCol]);
  }, [items, sortCol]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((i) => i.issueCount > 0 || i.useCount > 0).length,
    issueTotal: items.reduce((s, i) => s + i.issueTotal, 0),
    useTotal: items.reduce((s, i) => s + i.useTotal, 0),
    issueCount: items.reduce((s, i) => s + i.issueCount, 0),
    useCount: items.reduce((s, i) => s + i.useCount, 0),
  }), [items]);

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "thisMonth", label: "이번 달" },
    { key: "lastMonth", label: "지난 달" },
    { key: "3months", label: "최근 3개월" },
    { key: "all", label: "전체" },
  ];

  const SORT_COLS: { key: typeof sortCol; label: string }[] = [
    { key: "issueTotal", label: "지급금액순" },
    { key: "issueCount", label: "지급건수순" },
    { key: "useTotal", label: "차감금액순" },
    { key: "useCount", label: "차감건수순" },
    { key: "uniqueCustomers", label: "이용고객순" },
  ];

  return (
    <main className="space-y-5">
      {/* 헤더 + 필터 */}
      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">제휴사 통계</h1>
            <p className="text-sm text-muted-foreground mt-1">제휴사별 포인트 지급·차감·이용 고객 현황</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="h-9 px-4 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-80 transition-opacity"
          >
            새로고침
          </button>
        </div>

        {/* 기간 프리셋 */}
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={`h-8 px-3.5 rounded-lg text-sm font-bold transition-all ${
                preset === p.key
                  ? "text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              style={preset === p.key ? { background: "oklch(0.52 0.27 264)" } : undefined}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={`h-8 px-3.5 rounded-lg text-sm font-bold transition-all ${
              preset === "custom"
                ? "text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            style={preset === "custom" ? { background: "oklch(0.52 0.27 264)" } : undefined}
          >
            직접 입력
          </button>
        </div>

        {/* 날짜 직접 입력 */}
        {preset === "custom" && (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border text-sm bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border text-sm bg-background"
              />
            </div>
            <button
              type="button"
              onClick={load}
              className="h-9 px-4 rounded-lg text-sm font-bold bg-foreground text-background hover:opacity-80 transition-opacity"
            >
              조회
            </button>
          </div>
        )}
      </section>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "전체 제휴사", value: `${fmt(summary.total)}개` },
          { label: "거래 발생", value: `${fmt(summary.active)}개` },
          { label: "총 지급 건수", value: `${fmt(summary.issueCount)}건` },
          { label: "총 지급 포인트", value: `${fmt(summary.issueTotal)}P`, highlight: true },
          { label: "총 차감 건수", value: `${fmt(summary.useCount)}건` },
          { label: "총 차감 포인트", value: `${fmt(summary.useTotal)}P` },
        ].map((card) => (
          <div key={card.label} className="bg-card shadow-card rounded-2xl p-4">
            <div className="text-xs font-bold text-muted-foreground mb-2">{card.label}</div>
            <div
              className="text-xl font-black leading-none"
              style={card.highlight ? { color: "oklch(0.52 0.27 264)" } : undefined}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* 테이블 + 상세 패널 */}
      <div className="flex gap-4 items-start">
        {/* 테이블 */}
        <section className="bg-card shadow-card rounded-2xl p-5 flex-1 min-w-0">
          {/* 정렬 */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground">정렬:</span>
            {SORT_COLS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSortCol(c.key)}
                className={`h-7 px-3 rounded-lg text-xs font-bold transition-all ${
                  sortCol === c.key
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                style={sortCol === c.key ? { background: "oklch(0.52 0.27 264)" } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>
          ) : (
            <>
              {/* 데스크탑 테이블 */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-xs font-black text-muted-foreground w-6">#</th>
                      <th className="text-left py-2.5 px-3 text-xs font-black text-muted-foreground">제휴사</th>
                      <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">잠재고객</th>
                      <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">신청고객</th>
                      <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">이용고객</th>
                      <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">지급 건수</th>
                      <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">지급 포인트</th>
                      <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">차감 건수</th>
                      <th className="text-right py-2.5 px-3 text-xs font-black text-muted-foreground">차감 포인트</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((it, idx) => {
                      const active = selectedId === it.partnerId;
                      return (
                        <tr
                          key={it.partnerId}
                          onClick={() => openDetail(it.partnerId)}
                          className={`border-b border-border/50 cursor-pointer transition-colors ${
                            active ? "bg-primary/5" : "hover:bg-muted/40"
                          }`}
                        >
                          <td className="py-3 px-3 text-xs text-muted-foreground font-bold">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-black text-foreground">{it.name}</div>
                            <div className="text-xs text-muted-foreground">{it.username}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold">{fmt(it.likedCount)}명</td>
                          <td className="py-3 px-3 text-right font-semibold">{fmt(it.appliedCount)}명</td>
                          <td className="py-3 px-3 text-right font-bold" style={{ color: "oklch(0.52 0.27 264)" }}>{fmt(it.uniqueCustomers)}명</td>
                          <td className="py-3 px-3 text-right font-semibold">{fmt(it.issueCount)}건</td>
                          <td className="py-3 px-3 text-right font-black">{fmt(it.issueTotal)}P</td>
                          <td className="py-3 px-3 text-right font-semibold">{fmt(it.useCount)}건</td>
                          <td className="py-3 px-3 text-right font-black">{fmt(it.useTotal)}P</td>
                        </tr>
                      );
                    })}
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                          데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 모바일 카드 */}
              <div className="flex lg:hidden flex-col gap-3">
                {sorted.map((it, idx) => {
                  const active = selectedId === it.partnerId;
                  return (
                    <article
                      key={it.partnerId}
                      onClick={() => openDetail(it.partnerId)}
                      className={`border rounded-2xl p-4 cursor-pointer transition-colors space-y-3 ${
                        active ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-muted-foreground w-5">{idx + 1}</span>
                        <div>
                          <div className="font-black text-foreground">{it.name}</div>
                          <div className="text-xs text-muted-foreground">{it.username}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {[
                          { label: "잠재고객", value: `${fmt(it.likedCount)}명` },
                          { label: "이용고객", value: `${fmt(it.uniqueCustomers)}명`, highlight: true },
                          { label: "지급 건수", value: `${fmt(it.issueCount)}건` },
                          { label: "지급 포인트", value: `${fmt(it.issueTotal)}P`, bold: true },
                          { label: "차감 건수", value: `${fmt(it.useCount)}건` },
                          { label: "차감 포인트", value: `${fmt(it.useTotal)}P` },
                        ].map((row) => (
                          <div key={row.label} className="flex justify-between items-center border-t border-border/50 pt-2">
                            <span className="text-muted-foreground font-bold text-xs">{row.label}</span>
                            <span
                              className={`font-black text-xs ${row.bold ? "text-foreground" : ""}`}
                              style={row.highlight ? { color: "oklch(0.52 0.27 264)" } : undefined}
                            >
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
                {sorted.length === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">데이터가 없습니다.</div>
                )}
              </div>
            </>
          )}
        </section>

        {/* 상세 패널 */}
        {selectedId && (
          <aside className="bg-card shadow-card rounded-2xl p-5 w-80 shrink-0 hidden lg:block sticky top-28">
            {detailLoading || !detail ? (
              <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : (
              <div className="space-y-4">
                {/* 제휴사명 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-black text-lg text-foreground">{detail.partner.name}</div>
                    <div className="text-xs text-muted-foreground">{detail.partner.username}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(null); setDetail(null); }}
                    className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* 요약 지표 */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "잠재고객", value: `${fmt(detail.partner.likedCount)}명` },
                    { label: "신청고객", value: `${fmt(detail.partner.appliedCount)}명` },
                    { label: "이용고객", value: `${fmt(detail.summary.uniqueCustomers)}명`, highlight: true },
                    { label: "지급 포인트", value: `${fmt(detail.summary.issueTotal)}P`, highlight: true },
                    { label: "지급 건수", value: `${fmt(detail.summary.issueCount)}건` },
                    { label: "차감 포인트", value: `${fmt(detail.summary.useTotal)}P` },
                  ].map((c) => (
                    <div key={c.label} className="bg-muted/50 rounded-xl p-3">
                      <div className="text-xs font-bold text-muted-foreground mb-1">{c.label}</div>
                      <div
                        className="text-base font-black"
                        style={c.highlight ? { color: "oklch(0.52 0.27 264)" } : undefined}
                      >
                        {c.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 월별 내역 */}
                <div>
                  <div className="text-xs font-black text-muted-foreground mb-2">월별 내역</div>
                  {detail.monthly.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">내역 없음</div>
                  ) : (
                    <div className="space-y-1">
                      {detail.monthly.map((m) => (
                        <div key={m.month} className="border border-border/50 rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-black text-foreground">{m.month}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">지급</span>
                              <span className="font-black">{fmt(m.issueTotal)}P</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">차감</span>
                              <span className="font-bold">{fmt(m.useTotal)}P</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground/70">
                              <span>{fmt(m.issueCount)}건</span>
                              <span>{fmt(m.useCount)}건</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* 모바일 상세 (하단 시트) */}
      {selectedId && detail && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setSelectedId(null); setDetail(null); }}
          />
          <div className="relative z-10 w-full bg-card rounded-t-3xl p-5 max-h-[75vh] overflow-y-auto space-y-4">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-2" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-black text-lg">{detail.partner.name}</div>
                <div className="text-xs text-muted-foreground">{detail.partner.username}</div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedId(null); setDetail(null); }}
                className="text-muted-foreground text-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "이용고객", value: `${fmt(detail.summary.uniqueCustomers)}명`, highlight: true },
                { label: "지급 포인트", value: `${fmt(detail.summary.issueTotal)}P`, highlight: true },
                { label: "차감 포인트", value: `${fmt(detail.summary.useTotal)}P` },
                { label: "잠재고객", value: `${fmt(detail.partner.likedCount)}명` },
                { label: "신청고객", value: `${fmt(detail.partner.appliedCount)}명` },
                { label: "지급 건수", value: `${fmt(detail.summary.issueCount)}건` },
              ].map((c) => (
                <div key={c.label} className="bg-muted/50 rounded-xl p-3">
                  <div className="text-xs font-bold text-muted-foreground mb-1">{c.label}</div>
                  <div className="text-sm font-black" style={c.highlight ? { color: "oklch(0.52 0.27 264)" } : undefined}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-black text-muted-foreground mb-2">월별 내역</div>
              <div className="space-y-2">
                {detail.monthly.map((m) => (
                  <div key={m.month} className="border border-border/50 rounded-xl px-3 py-2.5">
                    <div className="text-xs font-black mb-1">{m.month}</div>
                    <div className="grid grid-cols-2 gap-x-4 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">지급</span>
                        <span className="font-black">{fmt(m.issueTotal)}P ({fmt(m.issueCount)}건)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">차감</span>
                        <span className="font-bold">{fmt(m.useTotal)}P ({fmt(m.useCount)}건)</span>
                      </div>
                    </div>
                  </div>
                ))}
                {detail.monthly.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4">내역 없음</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
