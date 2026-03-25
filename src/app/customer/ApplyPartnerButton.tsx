"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { isKoreanHoliday, getHolidayName } from "@/lib/koreanHolidays";

type ScheduleConfig = {
  scheduleEnabled: boolean;
  operatingDays: number[];
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  maxPerSlot: number;
  advanceDays: number;
  breakStart?: string;
  breakEnd?: string;
  closedOnHolidays?: boolean;
  blockedDates?: string[];
};

type SlotInfo = {
  time: string;
  booked: number;
  max: number;
  available: boolean;
  isBreak?: boolean;
};

type AppointmentHistoryItem = {
  action: string; // "APPLIED" | "CANCELLED" | "CHANGED"
  appointmentAt: string;
  appointmentNote: string;
  previousAppointmentAt: string | null;
  createdAt: string;
};

type Props = {
  partnerId: string;
  initialApplied: boolean;
  initialAppointmentAt?: string | null;
  initialAppointmentNote?: string | null;
  initialAppointmentHistory?: AppointmentHistoryItem[];
  externalApplyUrl?: string;
  scheduleConfig?: ScheduleConfig | null;
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function getTodayStr() {
  const n = new Date();
  return toDateStr(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

function formatKoreanDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul",
    });
  } catch { return iso; }
}

// ──────────────────────────────────────────────
// 달력 컴포넌트
// ──────────────────────────────────────────────
function CalendarPicker({
  operatingDays,
  advanceDays,
  closedOnHolidays,
  blockedDates,
  value,
  onChange,
}: {
  operatingDays: number[];
  advanceDays: number;
  closedOnHolidays: boolean;
  blockedDates: string[];
  value: string;
  onChange: (date: string) => void;
}) {
  const todayStr = getTodayStr();
  const today = new Date();

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + advanceDays);
  const maxStr = toDateStr(maxDate.getFullYear(), maxDate.getMonth() + 1, maxDate.getDate());

  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth()); // 0-indexed

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // 현재 달의 첫 날 요일, 총 일수
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function isDisabled(dateStr: string) {
    if (dateStr < todayStr) return true;
    if (dateStr > maxStr) return true;
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (!operatingDays.includes(dow)) return true;
    if (closedOnHolidays && isKoreanHoliday(dateStr)) return true;
    if (blockedDates.includes(dateStr)) return true;
    return false;
  }

  function getDateLabel(dateStr: string): string | null {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (!operatingDays.includes(dow)) return "휴무";
    if (closedOnHolidays && isKoreanHoliday(dateStr)) return getHolidayName(dateStr);
    if (blockedDates.includes(dateStr)) return "휴무";
    return null;
  }

  function isOffDay(dow: number) {
    return !operatingDays.includes(dow);
  }

  // 이전 달 이동 가능 여부 (이번달 이전으로는 못 가게)
  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  // 다음 달 이동 가능 여부
  const canGoNext = (() => {
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    return toDateStr(nextY, nextM + 1, 1) <= maxStr;
  })();

  // 달력 셀 배열 (null = 빈 칸)
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden">
      {/* 헤더: 월 이동 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-foreground font-bold"
        >
          ‹
        </button>
        <span className="text-sm font-black text-foreground">
          {viewYear}년 {MONTH_NAMES[viewMonth]}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canGoNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-foreground font-bold"
        >
          ›
        </button>
      </div>

      <div className="p-3">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={cn(
                "text-center text-xs font-black py-1.5",
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground",
                isOffDay(i) && "opacity-40"
              )}
            >
              {label}
              {isOffDay(i) && <span className="block text-[8px] font-normal leading-none opacity-70">휴무</span>}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} />;

            const dateStr = toDateStr(viewYear, viewMonth + 1, day);
            const disabled = isDisabled(dateStr);
            const selected = dateStr === value;
            const isToday = dateStr === todayStr;
            const dow = (firstDow + (day - 1)) % 7;
            const isSun = dow === 0;
            const isSat = dow === 6;
            const dateLabel = disabled ? getDateLabel(dateStr) : null;
            const isHoliday = closedOnHolidays && isKoreanHoliday(dateStr);

            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => onChange(dateStr)}
                className={cn(
                  "relative w-full rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center",
                  dateLabel ? "h-11 py-0.5" : "h-9",
                  selected
                    ? "bg-foreground text-background shadow-sm"
                    : isToday
                    ? "bg-primary/10 text-primary"
                    : disabled
                    ? "text-muted-foreground/25 cursor-not-allowed"
                    : isHoliday
                    ? "text-red-500 hover:bg-red-50"
                    : isSun
                    ? "text-red-500 hover:bg-red-50"
                    : isSat
                    ? "text-blue-500 hover:bg-blue-50"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span>{day}</span>
                {dateLabel && (
                  <span className={cn(
                    "text-[8px] font-normal leading-none truncate max-w-full px-0.5",
                    selected ? "text-background/70" : isHoliday ? "text-red-400" : "text-muted-foreground/50"
                  )}>
                    {dateLabel}
                  </span>
                )}
                {isToday && !selected && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-foreground inline-block" />
          선택
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-primary/10 inline-block" />
          오늘
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-muted inline-block" />
          휴무/마감
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────
export default function ApplyPartnerButton({
  partnerId,
  initialApplied,
  initialAppointmentAt,
  initialAppointmentNote,
  initialAppointmentHistory,
  externalApplyUrl,
  scheduleConfig,
}: Props) {
  const [applied, setApplied] = useState(Boolean(initialApplied));
  const [appointmentAt, setAppointmentAt] = useState(initialAppointmentAt ?? "");
  const [appointmentNote, setAppointmentNote] = useState(initialAppointmentNote ?? "");
  const [appointmentHistory, setAppointmentHistory] = useState<AppointmentHistoryItem[]>(initialAppointmentHistory ?? []);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // 취소/변경 전용 상태
  const [cancelLoading, setCancelLoading] = useState(false);
  const [changeMode, setChangeMode] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotMsg, setSlotMsg] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [note, setNote] = useState("");

  const cfg: ScheduleConfig = scheduleConfig ?? {
    scheduleEnabled: true,
    operatingDays: [1, 2, 3, 4, 5],
    openTime: "09:00",
    closeTime: "18:00",
    slotMinutes: 30,
    maxPerSlot: 1,
    advanceDays: 30,
    breakStart: "",
    breakEnd: "",
    closedOnHolidays: true,
    blockedDates: [],
  };

  // 날짜 변경 → 슬롯 조회
  useEffect(() => {
    if (!date) { setSlots([]); setSelectedSlot(""); setSlotMsg(""); return; }
    setSlotsLoading(true);
    setSlotMsg("");
    setSelectedSlot("");
    fetch(`/api/customer/partners/${partnerId}/slots?date=${date}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setSlots(data.slots ?? []);
          if ((data.slots ?? []).length === 0) setSlotMsg(data.reason ?? "예약 가능한 슬롯이 없습니다.");
        } else {
          setSlots([]);
          setSlotMsg(data.message ?? "슬롯 조회 실패");
        }
      })
      .catch(() => setSlotMsg("네트워크 오류"))
      .finally(() => setSlotsLoading(false));
  }, [date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || applied || !date || !selectedSlot) return;
    setLoading(true);
    setMessage("");
    setIsError(false);

    const iso = new Date(`${date}T${selectedSlot}:00`).toISOString();

    try {
      const res = await fetch(`/api/customer/applications/${partnerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentAt: iso, appointmentNote: note }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setIsError(true);
        setMessage(data?.message ?? data?.error ?? "신청 처리에 실패했습니다.");
        return;
      }
      setApplied(true);
      setAppointmentAt(iso);
      setAppointmentNote(note);
      setAppointmentHistory(prev => [...prev, { action: "APPLIED", appointmentAt: iso, appointmentNote: note, previousAppointmentAt: null, createdAt: new Date().toISOString() }]);
      setMessage("신청이 완료되었습니다!");
    } catch {
      setIsError(true);
      setMessage("네트워크 오류로 신청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("정말 신청을 취소하시겠습니까?\n취소 후 찜 상태로 돌아가며 다시 신청할 수 있습니다.")) return;
    setCancelLoading(true);
    setActionMsg("");
    setActionError(false);
    try {
      const res = await fetch(`/api/customer/applications/${partnerId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setActionError(true);
        setActionMsg(data?.message ?? "취소 처리에 실패했습니다.");
        return;
      }
      setAppointmentHistory(prev => [...prev, { action: "CANCELLED", appointmentAt: appointmentAt, appointmentNote: appointmentNote, previousAppointmentAt: null, createdAt: new Date().toISOString() }]);
      setApplied(false);
      setAppointmentAt("");
      setAppointmentNote("");
      setActionMsg("신청이 취소되었습니다.");
    } catch {
      setActionError(true);
      setActionMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !date || !selectedSlot) return;
    setLoading(true);
    setActionMsg("");
    setActionError(false);

    const iso = new Date(`${date}T${selectedSlot}:00`).toISOString();
    try {
      const res = await fetch(`/api/customer/applications/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentAt: iso, appointmentNote: note }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setActionError(true);
        setActionMsg(data?.message ?? "변경 처리에 실패했습니다.");
        return;
      }
      setAppointmentHistory(prev => [...prev, { action: "CHANGED", appointmentAt: iso, appointmentNote: note, previousAppointmentAt: appointmentAt, createdAt: new Date().toISOString() }]);
      setAppointmentAt(iso);
      setAppointmentNote(note);
      setChangeMode(false);
      setDate("");
      setSelectedSlot("");
      setNote("");
      setActionMsg("방문 일정이 변경되었습니다.");
    } catch {
      setActionError(true);
      setActionMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ── 신청 완료 ──
  if (applied) {
    const historyActionLabel = (a: string) =>
      a === "APPLIED" ? "신청" : a === "CANCELLED" ? "취소" : "변경";
    const historyActionColor = (a: string) =>
      a === "APPLIED" ? "text-emerald-600" : a === "CANCELLED" ? "text-red-500" : "text-blue-600";

    return (
      <div className="space-y-3">
        {/* 현재 신청 상태 */}
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-black">✓</span>
            <span className="text-sm font-black text-emerald-800">신청 완료</span>
          </div>
          {appointmentAt && (
            <div className="text-sm text-emerald-700">
              <span className="font-bold">방문 희망 일시:</span> {formatKoreanDate(appointmentAt)}
            </div>
          )}
          {appointmentNote && (
            <div className="text-sm text-emerald-700">
              <span className="font-bold">메모:</span> {appointmentNote}
            </div>
          )}
          <p className="text-xs text-emerald-600 leading-relaxed">
            이 제휴사에는 내 상세정보가 공개됩니다.
          </p>
        </div>

        {/* 취소/변경 버튼 */}
        {!changeMode && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setChangeMode(true); setActionMsg(""); setActionError(false); setDate(""); setSelectedSlot(""); setNote(appointmentNote); }}
              className="flex-1 h-10 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-colors"
            >
              일정 변경
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelLoading}
              className="flex-1 h-10 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {cancelLoading ? "취소 중..." : "신청 취소"}
            </button>
          </div>
        )}

        {/* 변경 폼 */}
        {changeMode && (
          <form onSubmit={handleChange} className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-foreground">일정 변경</span>
              <button type="button" onClick={() => { setChangeMode(false); setActionMsg(""); setDate(""); setSelectedSlot(""); }} className="text-xs text-muted-foreground hover:text-foreground">
                ✕ 닫기
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">날짜 선택 <span className="text-destructive">*</span></label>
              <CalendarPicker
                operatingDays={cfg.operatingDays}
                advanceDays={cfg.advanceDays}
                closedOnHolidays={cfg.closedOnHolidays ?? true}
                blockedDates={cfg.blockedDates ?? []}
                value={date}
                onChange={(d) => { setDate(d); setSelectedSlot(""); }}
              />
            </div>

            {date && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">시간 선택 <span className="text-destructive">*</span></label>
                {slotsLoading && <div className="py-3 text-center text-sm text-muted-foreground">슬롯 조회 중...</div>}
                {!slotsLoading && slotMsg && <div className="p-3 rounded-xl bg-muted text-sm text-muted-foreground text-center">{slotMsg}</div>}
                {!slotsLoading && slots.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {slots.filter(s => !s.isBreak).map((slot) => {
                      const sel = selectedSlot === slot.time;
                      return (
                        <button key={slot.time} type="button" disabled={!slot.available} onClick={() => setSelectedSlot(slot.time)}
                          className={cn(
                            "py-2.5 rounded-xl border text-sm font-bold transition-all",
                            sel ? "bg-foreground text-background border-foreground shadow-sm"
                              : slot.available ? "bg-background text-foreground border-border hover:bg-muted"
                              : "bg-muted/40 text-muted-foreground/40 border-muted cursor-not-allowed"
                          )}>
                          {slot.time}
                          {!slot.available && <span className="block text-[10px] font-normal mt-0.5">마감</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {date && selectedSlot && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="추가 메모 (선택)"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            )}

            {actionMsg && <p className={`text-sm font-semibold ${actionError ? "text-destructive" : "text-emerald-700"}`}>{actionMsg}</p>}

            <button
              type="submit"
              disabled={loading || !date || !selectedSlot}
              className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              {loading ? "변경 중..." : !date ? "날짜를 선택해 주세요" : !selectedSlot ? "시간을 선택해 주세요" : "일정 변경 확인"}
            </button>
          </form>
        )}

        {actionMsg && !changeMode && (
          <p className={`text-sm font-semibold ${actionError ? "text-destructive" : "text-emerald-700"}`}>{actionMsg}</p>
        )}

        {/* 신청 이력 */}
        {appointmentHistory.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <span>신청 이력 ({appointmentHistory.length}건)</span>
              <span className="text-muted-foreground text-xs">{showHistory ? "▲ 접기" : "▼ 펼치기"}</span>
            </button>
            {showHistory && (
              <div className="divide-y divide-border">
                {[...appointmentHistory].reverse().map((h, i) => (
                  <div key={i} className="px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-black ${historyActionColor(h.action)}`}>
                        {historyActionLabel(h.action)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {h.createdAt ? formatKoreanDate(h.createdAt) : ""}
                      </span>
                    </div>
                    {h.action === "CHANGED" && h.previousAppointmentAt && (
                      <div className="text-xs text-muted-foreground line-through">
                        기존: {formatKoreanDate(h.previousAppointmentAt)}
                      </div>
                    )}
                    {h.appointmentAt && (
                      <div className="text-xs text-foreground font-semibold">
                        {h.action === "CHANGED" ? "변경: " : "일시: "}{formatKoreanDate(h.appointmentAt)}
                      </div>
                    )}
                    {h.appointmentNote && (
                      <div className="text-xs text-muted-foreground">메모: {h.appointmentNote}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {externalApplyUrl && (
          <a href={externalApplyUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center justify-center h-11 px-5 rounded-xl border border-border text-sm font-bold text-foreground bg-card hover:bg-muted transition-colors">
            외부 신청 링크 →
          </a>
        )}
      </div>
    );
  }

  const opDayText = cfg.operatingDays.map(d => DAY_LABELS[d]).join(" · ");

  // ── 신청 폼 ──
  return (
    <div className="space-y-4">
      {/* 신청하기 버튼 */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{ background: "oklch(0.52 0.27 264)" }}
          className="w-full h-12 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
        >
          신청하기
        </button>
      )}

      {externalApplyUrl && !showForm && (
        <a href={externalApplyUrl} target="_blank" rel="noreferrer"
          className="flex items-center justify-center h-11 w-full rounded-xl border border-border text-sm font-bold text-foreground bg-card hover:bg-muted transition-colors">
          외부 신청 링크
        </a>
      )}

      {showForm && (
      <form onSubmit={submit} className="space-y-5">
      {/* 운영 안내 */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted font-bold text-foreground">
          📅 {opDayText}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted font-bold text-foreground">
          🕐 {cfg.openTime} ~ {cfg.closeTime}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted font-bold text-foreground">
          ⏱ {cfg.slotMinutes}분 단위
        </span>
        {cfg.breakStart && cfg.breakEnd && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 font-bold text-amber-700 text-xs">
            🚫 휴무 {cfg.breakStart}~{cfg.breakEnd}
          </span>
        )}
      </div>

      {/* STEP 1 — 날짜 선택 (달력) */}
      <div className="space-y-2">
        <label className="text-sm font-black text-foreground flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-foreground text-background text-xs font-black">1</span>
          날짜 선택
          <span className="text-destructive">*</span>
        </label>
        <CalendarPicker
          operatingDays={cfg.operatingDays}
          advanceDays={cfg.advanceDays}
          closedOnHolidays={cfg.closedOnHolidays ?? true}
          blockedDates={cfg.blockedDates ?? []}
          value={date}
          onChange={(d) => { setDate(d); setSelectedSlot(""); }}
        />
      </div>

      {/* STEP 2 — 시간 슬롯 */}
      {date && (
        <div className="space-y-2">
          <label className="text-sm font-black text-foreground flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-foreground text-background text-xs font-black">2</span>
            시간 선택
            <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground ml-auto">{date}</span>
          </label>

          {slotsLoading && (
            <div className="py-4 text-center text-sm text-muted-foreground">슬롯 조회 중...</div>
          )}

          {!slotsLoading && slotMsg && (
            <div className="p-3 rounded-xl bg-muted text-sm text-muted-foreground text-center">
              {slotMsg}
            </div>
          )}

          {!slotsLoading && slots.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {slots.filter((slot) => !slot.isBreak).map((slot) => {
                const selected = selectedSlot === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot.time)}
                    className={cn(
                      "py-2.5 rounded-xl border text-sm font-bold transition-all",
                      selected
                        ? "bg-foreground text-background border-foreground shadow-sm"
                        : slot.available
                        ? "bg-background text-foreground border-border hover:bg-muted hover:border-foreground/30"
                        : "bg-muted/40 text-muted-foreground/40 border-muted cursor-not-allowed"
                    )}
                  >
                    {slot.time}
                    {!slot.available && (
                      <span className="block text-[10px] font-normal mt-0.5">마감</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedSlot && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground/5 border border-foreground/10">
              <span className="text-xs text-muted-foreground">선택된 일시</span>
              <span className="text-sm font-black text-foreground ml-auto">
                {date} {selectedSlot}
              </span>
            </div>
          )}
        </div>
      )}

      {/* STEP 3 — 메모 */}
      {date && selectedSlot && (
        <div className="space-y-1.5">
          <label className="text-sm font-black text-foreground flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-foreground text-background text-xs font-black">3</span>
            추가 메모
            <span className="font-normal text-muted-foreground text-xs">(선택)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="문의사항이나 요청사항을 입력해 주세요"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <p className="text-xs text-muted-foreground text-right">{note.length}/200</p>
        </div>
      )}

      {/* 에러/성공 메시지 */}
      {message && (
        <p className={`text-sm font-semibold ${isError ? "text-destructive" : "text-emerald-700"}`}>
          {message}
        </p>
      )}

      {/* 신청 버튼 */}
      <button
        type="submit"
        disabled={loading || !date || !selectedSlot}
        style={{ background: "oklch(0.52 0.27 264)" }}
        className="w-full h-12 rounded-xl text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {loading ? "신청 중..." : !date ? "날짜를 선택해 주세요" : !selectedSlot ? "시간을 선택해 주세요" : "제휴사에 신청하기"}
      </button>

      <button
        type="button"
        onClick={() => { setShowForm(false); setDate(""); setSelectedSlot(""); setNote(""); setMessage(""); }}
        className="w-full h-10 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
      >
        취소
      </button>

      <p className="text-xs text-muted-foreground leading-relaxed">
        신청 전에는 제휴사에 최소 정보만 공개됩니다. 신청 후 이름·연락처·주소가 공개됩니다.
      </p>
    </form>
      )}
    </div>
  );
}
