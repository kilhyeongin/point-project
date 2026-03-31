"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search, X, Phone, Calendar, Clock, FileText } from "lucide-react";
import ScheduleSettingsTab from "./ScheduleSettingsTab";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "NOSHOW" | "CANCELLED";

type Appointment = {
  id: string;
  customerId: string;
  customerName: string;
  customerUsername: string;
  customerPhone: string;
  appointmentAt: string | null;
  appointmentNote: string;
  appointmentStatus: AppointmentStatus;
  appliedAt: string | null;
  updatedAt: string | null;
};

type PeriodFilter = "today" | "week" | "month" | "all";
type TabType = "list" | "calendar" | "settings";

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: "대기중",  color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  CONFIRMED: { label: "확정",    color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  COMPLETED: { label: "완료",    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  NOSHOW:    { label: "노쇼",    color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
  CANCELLED: { label: "취소",    color: "text-gray-500",    bg: "bg-gray-50",    border: "border-gray-200" },
};

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={cn("inline-flex items-center h-6 px-2.5 rounded-full text-xs font-black border", cfg.color, cfg.bg, cfg.border)}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${["일","월","화","수","목","금","토"][d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateShort(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPeriodRange(period: PeriodFilter, anchor: Date): { start: string | null; end: string | null } {
  if (period === "all") return { start: null, end: null };
  const d = new Date(anchor);
  if (period === "today") {
    const s = toYMD(d);
    return { start: s, end: s };
  }
  if (period === "week") {
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: toYMD(mon), end: toYMD(sun) };
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toYMD(first), end: toYMD(last) };
}

export default function PartnerAppointmentsPage() {
  const [tab, setTab] = useState<TabType>("list");
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const panelRef = useRef<HTMLDivElement>(null);

  const { start, end } = useMemo(() => getPeriodRange(period, anchor), [period, anchor]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      const res = await fetch(`/api/partner/appointments?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [start, end]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const lower = q.toLowerCase();
    return items.filter(
      (i) => i.customerName.toLowerCase().includes(lower) || i.customerPhone.includes(q)
    );
  }, [items, q]);

  const today = toYMD(new Date());
  const todayItems = items.filter((i) => i.appointmentAt && i.appointmentAt.startsWith(today));
  const pendingCount = items.filter((i) => i.appointmentStatus === "PENDING").length;
  const todayCancelCount = items.filter(
    (i) => i.appointmentStatus === "CANCELLED" && i.updatedAt?.startsWith(today)
  ).length;

  async function updateStatus(id: string, status: AppointmentStatus) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/partner/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentStatus: status }),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, appointmentStatus: status } : i));
        setSelected((prev) => prev?.id === id ? { ...prev, appointmentStatus: status } : prev);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  function moveAnchor(dir: number) {
    const d = new Date(anchor);
    if (period === "today") d.setDate(d.getDate() + dir);
    else if (period === "week") d.setDate(d.getDate() + dir * 7);
    else if (period === "month") d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  }

  function anchorLabel() {
    if (period === "today") return `${anchor.getFullYear()}.${String(anchor.getMonth()+1).padStart(2,"0")}.${String(anchor.getDate()).padStart(2,"0")}`;
    if (period === "week") {
      const { start: s, end: e } = getPeriodRange("week", anchor);
      return `${s} ~ ${e}`;
    }
    return `${anchor.getFullYear()}.${String(anchor.getMonth()+1).padStart(2,"0")}`;
  }

  const calDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const days: (Date | null)[] = Array(startDay).fill(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calMonth]);

  const calCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      if (!i.appointmentAt) return;
      const key = i.appointmentAt.slice(0, 10);
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [items]);

  return (
    <main className="min-w-0 space-y-4">
      {/* 헤더 */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <h1 className="text-xl sm:text-2xl font-black text-foreground mb-1">예약 관리</h1>
        <p className="text-sm text-muted-foreground">고객 예약을 확인하고 상태를 관리합니다.</p>
      </section>

      {/* 탭 */}
      <div className="flex border-b border-border bg-card rounded-t-2xl px-2">
        {([["list", "예약자관리"], ["calendar", "예약현황"], ["settings", "예약설정"]] as [TabType, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-4 h-11 text-sm font-black border-b-2 transition-all whitespace-nowrap",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <section className="bg-card shadow-card rounded-2xl overflow-hidden">
          {/* 필터 바 */}
          <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border space-y-3">
            {/* 기간 + 검색 아이콘 */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-muted rounded-lg p-0.5 flex-1 sm:flex-none">
                {([["today","오늘"],["week","7일"],["month","한달"],["all","전체"]] as [PeriodFilter,string][]).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setPeriod(v); setAnchor(new Date()); }}
                    className={cn(
                      "flex-1 sm:flex-none px-2 sm:px-3 h-7 rounded-md text-xs font-black transition-colors",
                      period === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setShowSearch((s) => !s); if (showSearch) setQ(""); }}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                  showSearch ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"
                )}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* 검색창 */}
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="이름 / 전화번호 검색"
                  className="pl-8 h-9 text-sm w-full"
                  autoFocus
                />
                {q && (
                  <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            )}

            {/* 날짜 네비게이션 */}
            {period !== "all" && (
              <div className="flex items-center justify-center gap-1">
                <button type="button" onClick={() => moveAnchor(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-foreground min-w-0 flex-1 text-center truncate">{anchorLabel()}</span>
                <button type="button" onClick={() => moveAnchor(1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 요약 수치 */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "오늘이용", value: todayItems.length, color: "text-foreground" },
                { label: "확정대기", value: pendingCount, color: "text-amber-600" },
                { label: "오늘취소", value: todayCancelCount, color: "text-red-500" },
                { label: "총 예약", value: filtered.length, color: "text-primary" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-muted/40 rounded-xl px-2 py-2 text-center">
                  <div className={cn("text-lg font-black leading-tight", color)}>{value}</div>
                  <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 리스트 */}
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground font-semibold">예약이 없습니다.</div>
          ) : (
            <>
              {/* 모바일: 카드형 */}
              <div className="sm:hidden divide-y divide-border/60">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={cn(
                      "px-4 py-3.5 cursor-pointer active:bg-muted/60 transition-colors",
                      selected?.id === item.id && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-foreground text-sm truncate">{item.customerName}</span>
                        <span className="text-xs text-muted-foreground truncate">{item.customerUsername}</span>
                      </div>
                      <StatusBadge status={item.appointmentStatus} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span className="font-semibold text-foreground">{formatDate(item.appointmentAt)}</span>
                      </div>
                      {item.customerPhone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{item.customerPhone}</span>
                        </div>
                      )}
                      {item.appointmentNote && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.appointmentNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* PC: 테이블형 */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">예약자</th>
                      <th className="px-4 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">전화번호</th>
                      <th className="px-4 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">이용일시</th>
                      <th className="px-4 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">요청사항</th>
                      <th className="px-4 py-3 text-left text-xs font-black text-muted-foreground whitespace-nowrap">신청일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelected(item)}
                        className={cn(
                          "border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/40 transition-colors",
                          selected?.id === item.id && "bg-primary/5"
                        )}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <StatusBadge status={item.appointmentStatus} />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-black text-foreground">{item.customerName}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{item.customerUsername}</span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">{item.customerPhone || "-"}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-foreground">{formatDate(item.appointmentAt)}</td>
                        <td className="px-4 py-3.5 max-w-[160px] truncate text-muted-foreground">{item.appointmentNote || "-"}</td>
                        <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">{formatDateShort(item.appliedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "calendar" && (
        <section className="bg-card shadow-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-5">
            <button type="button" onClick={() => setCalMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-black text-foreground">
              {calMonth.getFullYear()}년 {calMonth.getMonth() + 1}월
            </span>
            <button type="button" onClick={() => setCalMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {["일","월","화","수","목","금","토"].map((d, i) => (
              <div key={d} className={cn("text-center text-xs font-black py-2", i === 0 && "text-red-400", i === 6 && "text-blue-400", i > 0 && i < 6 && "text-muted-foreground")}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
            {calDays.map((day, i) => {
              if (!day) return <div key={i} className="bg-muted/30 min-h-[52px] sm:min-h-[72px]" />;
              const ymd = toYMD(day);
              const count = calCounts[ymd] ?? 0;
              const isToday = ymd === toYMD(new Date());
              const isSun = day.getDay() === 0;
              const isSat = day.getDay() === 6;
              return (
                <div
                  key={i}
                  onClick={() => { setPeriod("today"); setAnchor(day); setTab("list"); }}
                  className={cn(
                    "bg-card min-h-[52px] sm:min-h-[72px] p-1.5 sm:p-2 cursor-pointer active:bg-muted/60 hover:bg-muted/40 transition-colors",
                    isToday && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "text-xs sm:text-sm font-black w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full mb-1",
                    isToday ? "bg-primary text-white" : isSun ? "text-red-400" : isSat ? "text-blue-400" : "text-foreground"
                  )}>
                    {day.getDate()}
                  </div>
                  {count > 0 && (
                    <span className="text-[10px] font-black text-primary bg-primary/10 rounded px-1 py-0.5 block text-center">
                      {count}건
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground text-center">날짜를 클릭하면 해당 날짜의 예약자 목록으로 이동합니다</p>
        </section>
      )}

      {tab === "settings" && <ScheduleSettingsTab />}

      {/* 상세 패널 — 모바일: 하단 시트 / PC: 우측 슬라이드 */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelected(null)} />

          {/* PC: 우측 패널 */}
          <div
            ref={panelRef}
            className="hidden sm:flex fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-card shadow-2xl flex-col"
            style={{ borderLeft: "1px solid oklch(0.918 0.008 250)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-black text-foreground">예약 상세정보</h2>
              <button type="button" onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <PanelBody selected={selected} />
            <PanelActions selected={selected} updatingId={updatingId} updateStatus={updateStatus} />
          </div>

          {/* 모바일: 하단 시트 */}
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]"
            style={{ borderTop: "1px solid oklch(0.918 0.008 250)" }}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-base font-black text-foreground">예약 상세정보</h2>
              <button type="button" onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <PanelBody selected={selected} />
            <PanelActions selected={selected} updatingId={updatingId} updateStatus={updateStatus} />
          </div>
        </>
      )}
    </main>
  );
}

function PanelBody({ selected }: { selected: Appointment }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
      <div className="flex items-center gap-2">
        <StatusBadge status={selected.appointmentStatus} />
        <span className="text-xs text-muted-foreground">현재 상태</span>
      </div>

      {/* 예약자 정보 */}
      <div className="bg-muted/30 rounded-xl p-3.5 space-y-2.5">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">예약자 정보</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-black text-primary">{selected.customerName.charAt(0)}</span>
          </div>
          <div>
            <div className="font-black text-foreground text-sm">{selected.customerName}</div>
            <div className="text-xs text-muted-foreground">{selected.customerUsername}</div>
          </div>
        </div>
        {selected.customerPhone && (
          <a
            href={`tel:${selected.customerPhone}`}
            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {selected.customerPhone}
          </a>
        )}
      </div>

      {/* 예약 내역 */}
      <div>
        <p className="text-xs font-black text-muted-foreground uppercase tracking-wide mb-2.5">예약 내역</p>
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">이용일시</div>
              <div className="text-sm font-black text-foreground">{formatDate(selected.appointmentAt)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">신청일시</div>
              <div className="text-sm font-semibold text-foreground">{formatDate(selected.appliedAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 요청사항 */}
      {selected.appointmentNote && (
        <div>
          <p className="text-xs font-black text-muted-foreground uppercase tracking-wide mb-2">요청사항</p>
          <p className="text-sm text-foreground leading-relaxed bg-muted/50 rounded-xl p-3">
            {selected.appointmentNote}
          </p>
        </div>
      )}
    </div>
  );
}

function PanelActions({
  selected,
  updatingId,
  updateStatus,
}: {
  selected: Appointment;
  updatingId: string | null;
  updateStatus: (id: string, status: AppointmentStatus) => void;
}) {
  return (
    <div className="px-4 sm:px-5 py-4 border-t border-border shrink-0">
      <div className="grid grid-cols-2 gap-2">
        {selected.appointmentStatus === "PENDING" && (
          <>
            <button
              type="button"
              disabled={updatingId === selected.id}
              onClick={() => updateStatus(selected.id, "CONFIRMED")}
              className="h-11 rounded-xl text-sm font-black text-white transition-colors disabled:opacity-50"
              style={{ background: "oklch(0.52 0.27 264)" }}
            >
              예약 확정
            </button>
            <button
              type="button"
              disabled={updatingId === selected.id}
              onClick={() => updateStatus(selected.id, "CANCELLED")}
              className="h-11 rounded-xl text-sm font-black border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              예약 취소
            </button>
          </>
        )}
        {selected.appointmentStatus === "CONFIRMED" && (
          <>
            <button
              type="button"
              disabled={updatingId === selected.id}
              onClick={() => updateStatus(selected.id, "COMPLETED")}
              className="h-11 rounded-xl text-sm font-black text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              예약 완료
            </button>
            <button
              type="button"
              disabled={updatingId === selected.id}
              onClick={() => updateStatus(selected.id, "NOSHOW")}
              className="h-11 rounded-xl text-sm font-black border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              노쇼
            </button>
          </>
        )}
        {(selected.appointmentStatus === "COMPLETED" || selected.appointmentStatus === "NOSHOW" || selected.appointmentStatus === "CANCELLED") && (
          <button
            type="button"
            disabled={updatingId === selected.id}
            onClick={() => updateStatus(selected.id, "PENDING")}
            className="col-span-2 h-11 rounded-xl text-sm font-black border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            대기중으로 되돌리기
          </button>
        )}
      </div>
    </div>
  );
}
