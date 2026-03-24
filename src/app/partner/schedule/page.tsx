"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const SLOT_OPTIONS = [
  { value: 15, label: "15분" },
  { value: 30, label: "30분" },
  { value: 60, label: "1시간" },
  { value: 120, label: "2시간" },
];

type Schedule = {
  scheduleEnabled: boolean;
  operatingDays: number[];
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  maxPerSlot: number;
  advanceDays: number;
  breakStart: string;
  breakEnd: string;
  closedOnHolidays: boolean;
  blockedDates: string[];
};

const DEFAULT: Schedule = {
  scheduleEnabled: true,
  operatingDays: [1, 2, 3, 4, 5],
  openTime: "09:00",
  closeTime: "18:00",
  slotMinutes: 30,
  maxPerSlot: 1,
  advanceDays: 30,
  breakStart: "12:00",
  breakEnd: "13:00",
  closedOnHolidays: true,
  blockedDates: [],
};

function previewSlots(open: string, close: string, slotMin: number): string[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const toTime = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const slots: string[] = [];
  const openMin = toMin(open);
  const closeMin = toMin(close);
  for (let cur = openMin; cur + slotMin <= closeMin; cur += slotMin) {
    slots.push(toTime(cur));
  }
  return slots;
}

export default function PartnerSchedulePage() {
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetch("/api/partner/schedule", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setSchedule({ ...DEFAULT, ...data.schedule });
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(day: number) {
    setSchedule((prev) => ({
      ...prev,
      operatingDays: prev.operatingDays.includes(day)
        ? prev.operatingDays.filter((d) => d !== day)
        : [...prev.operatingDays, day].sort(),
    }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    setIsError(false);
    try {
      const res = await fetch("/api/partner/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const data = await res.json();
      setIsError(!data.ok);
      setMsg(data.message ?? (data.ok ? "저장되었습니다." : "저장 실패"));
    } catch {
      setIsError(true);
      setMsg("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  const slots = previewSlots(schedule.openTime, schedule.closeTime, schedule.slotMinutes);

  if (loading) {
    return (
      <main className="min-w-0 space-y-5">
        <div className="bg-card shadow-card rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 space-y-5">
      {/* Header */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <h1 className="text-2xl font-black text-foreground mb-1">예약 설정</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          고객이 방문 희망 날짜/시간을 슬롯 단위로 선택할 수 있도록 설정합니다.
        </p>
      </section>

      {/* Operating Days */}
      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-black text-foreground">운영 요일</h2>
        <div className="flex gap-2 flex-wrap">
          {DAY_LABELS.map((label, dayIndex) => {
            const active = schedule.operatingDays.includes(dayIndex);
            const isSun = dayIndex === 0;
            const isSat = dayIndex === 6;
            return (
              <button
                key={dayIndex}
                type="button"
                onClick={() => toggleDay(dayIndex)}
                className={cn(
                  "relative w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all",
                  active
                    ? isSun
                      ? "bg-red-500 border-red-500 text-white shadow-sm"
                      : isSat
                      ? "bg-blue-500 border-blue-500 text-white shadow-sm"
                      : "bg-primary border-primary text-white shadow-sm"
                    : "bg-background border-border hover:border-muted-foreground/40 hover:bg-muted"
                )}
              >
                <span className={cn(
                  "text-sm font-black leading-none",
                  !active && isSun && "text-red-400",
                  !active && isSat && "text-blue-400",
                  !active && !isSun && !isSat && "text-muted-foreground"
                )}>
                  {label}
                </span>
                <span className={cn(
                  "text-[10px] font-bold leading-none",
                  active ? "text-white/80" : "text-muted-foreground/50"
                )}>
                  {active ? "✓ 운영" : "휴무"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">선택된 요일에만 예약을 받습니다. 기본: 월~금 (토·일 휴무)</p>
      </section>

      {/* Operating Hours */}
      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-black text-foreground">운영 시간</h2>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted-foreground">시작 시간</label>
            <Input
              type="time"
              value={schedule.openTime}
              onChange={(e) => setSchedule((p) => ({ ...p, openTime: e.target.value }))}
              className="w-36 h-11"
            />
          </div>
          <span className="pb-2.5 text-muted-foreground font-bold text-base">~</span>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted-foreground">종료 시간</label>
            <Input
              type="time"
              value={schedule.closeTime}
              onChange={(e) => setSchedule((p) => ({ ...p, closeTime: e.target.value }))}
              className="w-36 h-11"
            />
          </div>
        </div>

        {/* 공휴일 체크 */}
        <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={schedule.closedOnHolidays}
              onChange={(e) => setSchedule((p) => ({ ...p, closedOnHolidays: e.target.checked }))}
            />
            <div className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
              schedule.closedOnHolidays
                ? "bg-foreground border-foreground"
                : "bg-background border-border"
            )}>
              {schedule.closedOnHolidays && (
                <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                  <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm font-bold text-foreground">공휴일 휴무</span>
          <span className="text-xs text-muted-foreground">(설날·추석·크리스마스 등)</span>
        </label>
      </section>

      {/* Break Time */}
      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground">휴무 시간</h2>
          <button
            type="button"
            onClick={() => setSchedule((p) => ({ ...p, breakStart: p.breakStart ? "" : "12:00", breakEnd: p.breakEnd ? "" : "13:00" }))}
            className={cn(
              "text-xs font-bold px-3 h-7 rounded-lg border transition-colors",
              schedule.breakStart
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {schedule.breakStart ? "사용 중" : "사용 안 함"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          점심시간 등 예약을 받지 않을 시간대를 설정합니다. 해당 시간대 슬롯은 고객에게 &ldquo;휴무&rdquo;로 표시됩니다.
        </p>
        {schedule.breakStart !== "" && (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-muted-foreground">휴무 시작</label>
              <Input
                type="time"
                value={schedule.breakStart}
                onChange={(e) => setSchedule((p) => ({ ...p, breakStart: e.target.value }))}
                className="w-36 h-11"
              />
            </div>
            <span className="pb-2.5 text-muted-foreground font-bold text-base">~</span>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-muted-foreground">휴무 종료</label>
              <Input
                type="time"
                value={schedule.breakEnd}
                onChange={(e) => setSchedule((p) => ({ ...p, breakEnd: e.target.value }))}
                className="w-36 h-11"
              />
            </div>
          </div>
        )}
      </section>

      {/* Slot Duration */}
      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-black text-foreground">예약 단위</h2>
        <div className="flex gap-2 flex-wrap">
          {SLOT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSchedule((p) => ({ ...p, slotMinutes: opt.value }))}
              className={cn(
                "px-4 h-10 rounded-xl border text-sm font-black transition-colors",
                schedule.slotMinutes === opt.value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {slots.length > 0 && (
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2">
              슬롯 미리보기 ({slots.length}개)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {slots.slice(0, 24).map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-lg bg-muted text-xs font-bold text-foreground">
                  {s}
                </span>
              ))}
              {slots.length > 24 && (
                <span className="px-2.5 py-1 rounded-lg bg-muted text-xs text-muted-foreground">
                  +{slots.length - 24}개
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Capacity & Advance */}
      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-black text-foreground">예약 조건</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-foreground">슬롯당 최대 예약 수</label>
            <p className="text-xs text-muted-foreground">같은 시간에 최대 몇 명까지 예약 가능한지 설정합니다.</p>
            <Input
              type="number"
              min={1}
              max={99}
              value={schedule.maxPerSlot}
              onChange={(e) => setSchedule((p) => ({ ...p, maxPerSlot: Number(e.target.value) || 1 }))}
              className="w-24 h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-foreground">최대 예약 가능 기간 (일)</label>
            <p className="text-xs text-muted-foreground">오늘부터 몇 일 후까지 예약을 허용할지 설정합니다.</p>
            <Input
              type="number"
              min={1}
              max={365}
              value={schedule.advanceDays}
              onChange={(e) => setSchedule((p) => ({ ...p, advanceDays: Number(e.target.value) || 30 }))}
              className="w-24 h-10"
            />
          </div>
        </div>
      </section>

      {/* Blocked Dates */}
      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-black text-foreground">특별 휴무일</h2>
          <p className="text-xs text-muted-foreground mt-0.5">공사, 행사, 개인 사유 등 특정 날짜에 예약을 막습니다</p>
        </div>

        {/* 날짜 추가 */}
        <div className="flex items-end gap-2">
          <div className="space-y-1.5 flex-1 max-w-[180px]">
            <label className="block text-xs font-bold text-muted-foreground">날짜 추가</label>
            <Input
              type="date"
              id="blockedDateInput"
              min={new Date().toISOString().slice(0, 10)}
              className="h-11"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById("blockedDateInput") as HTMLInputElement;
              const val = input?.value;
              if (!val) return;
              if (schedule.blockedDates.includes(val)) return;
              setSchedule((p) => ({ ...p, blockedDates: [...p.blockedDates, val].sort() }));
              input.value = "";
            }}
            className="h-11 px-4 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-80 transition-opacity"
          >
            추가
          </button>
        </div>

        {/* 추가된 목록 */}
        {schedule.blockedDates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {schedule.blockedDates.map((d) => (
              <span key={d} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-sm font-bold text-foreground">
                {d}
                <button
                  type="button"
                  onClick={() => setSchedule((p) => ({ ...p, blockedDates: p.blockedDates.filter((x) => x !== d) }))}
                  className="w-4 h-4 rounded-full bg-muted-foreground/20 hover:bg-destructive hover:text-white text-muted-foreground text-xs flex items-center justify-center transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {schedule.blockedDates.length === 0 && (
          <p className="text-xs text-muted-foreground">등록된 특별 휴무일이 없습니다.</p>
        )}
      </section>

      {/* Save */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <Button onClick={save} disabled={saving} className="font-bold px-6">
            {saving ? "저장 중..." : "저장"}
          </Button>
          {msg && (
            <p className={`text-sm font-bold ${isError ? "text-destructive" : "text-emerald-600"}`}>
              {msg}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
