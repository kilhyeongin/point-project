// src/app/api/customer/partners/[id]/slots/route.ts
// GET : 특정 제휴사의 특정 날짜 예약 가능 슬롯 조회

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";
import { isKoreanHoliday, getHolidayName } from "@/lib/koreanHolidays";

type Params = { params: Promise<{ id: string }> };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ ok: false, message: "고객만 접근 가능합니다." }, { status: 403 });
  }

  const { id: partnerId } = await params;
  if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
    return NextResponse.json({ ok: false, message: "잘못된 업체 ID입니다." }, { status: 400 });
  }

  const dateParam = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ ok: false, message: "date 파라미터가 필요합니다. (YYYY-MM-DD)" }, { status: 400 });
  }

  await connectDB();

  const partner = await User.findOne(
    { _id: partnerId, organizationId: session.orgId ?? "4nwn", role: "PARTNER", status: "ACTIVE", "partnerProfile.isPublished": true },
    { partnerProfile: 1 }
  ).lean();

  if (!partner) {
    return NextResponse.json({ ok: false, message: "존재하지 않는 업체입니다." }, { status: 404 });
  }

  const p = (partner as any).partnerProfile ?? {};

  const operatingDays: number[] = Array.isArray(p.operatingDays) ? p.operatingDays : [1, 2, 3, 4, 5];
  const openTime: string = p.openTime ?? "09:00";
  const closeTime: string = p.closeTime ?? "18:00";
  const slotMinutes: number = Number(p.slotMinutes ?? 30);
  const maxPerSlot: number = Number(p.maxPerSlot ?? 1);
  const advanceDays: number = Number(p.advanceDays ?? 30);
  const breakStart: string = String(p.breakStart ?? "12:00");
  const breakEnd: string = String(p.breakEnd ?? "13:00");
  const closedOnHolidays: boolean = Boolean(p.closedOnHolidays ?? true);
  const blockedDates: string[] = Array.isArray(p.blockedDates) ? p.blockedDates : [];

  // 요청한 날짜의 요일 확인 (Korea local date)
  const [year, month, day] = dateParam.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day); // local date
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat

  if (!operatingDays.includes(dayOfWeek)) {
    return NextResponse.json({ ok: true, slots: [], reason: "운영하지 않는 요일입니다." });
  }

  // 공휴일 체크
  if (closedOnHolidays && isKoreanHoliday(dateParam)) {
    return NextResponse.json({ ok: true, slots: [], reason: `공휴일(${getHolidayName(dateParam)})입니다.` });
  }

  // 특정 휴무일 체크
  if (blockedDates.includes(dateParam)) {
    return NextResponse.json({ ok: true, slots: [], reason: "특별 휴무일입니다." });
  }

  // 예약 가능 기간 체크
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const maxDate = new Date(todayStart);
  maxDate.setDate(maxDate.getDate() + advanceDays);

  if (dateObj < todayStart || dateObj > maxDate) {
    return NextResponse.json({ ok: true, slots: [], reason: "예약 가능 기간이 아닙니다." });
  }

  // 슬롯 생성
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const slotTimes: string[] = [];
  for (let cur = openMin; cur + slotMinutes <= closeMin; cur += slotMinutes) {
    slotTimes.push(minutesToTime(cur));
  }

  // 해당 날짜의 기존 예약 조회 (KST 00:00 ~ 23:59:59 → UTC 15:00 전날 ~ 14:59:59)
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - kstOffset);
  const kstDayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59) - kstOffset);

  const existing = await FavoritePartner.find(
    {
      organizationId: session.orgId ?? "4nwn",
      partnerId: new mongoose.Types.ObjectId(partnerId),
      status: "APPLIED",
      appointmentAt: { $gte: kstDayStart, $lte: kstDayEnd },
    },
    { appointmentAt: 1 }
  ).lean();

  // 슬롯별 예약 수 계산
  const now = new Date();

  const slots = slotTimes.map((slotTime) => {
    const [sh, sm] = slotTime.split(":").map(Number);
    // KST → UTC: 당일 KST 시각에서 9시간 빼기 (kstOffset = 9h in ms)
    const slotStartKstMs = Date.UTC(year, month - 1, day, sh, sm, 0);
    const slotStart = new Date(slotStartKstMs - kstOffset);
    const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000);

    const bookedCount = existing.filter((e: any) => {
      const at = new Date(e.appointmentAt);
      return at >= slotStart && at < slotEnd;
    }).length;

    const isPast = slotStart <= now;

    // 휴무시간 체크 (슬롯 시작 시간이 breakStart 이상 breakEnd 미만이면 휴무)
    const isBreak =
      breakStart && breakEnd
        ? slotTime >= breakStart && slotTime < breakEnd
        : false;

    return {
      time: slotTime,              // "09:00"
      booked: bookedCount,
      max: maxPerSlot,
      available: !isPast && !isBreak && bookedCount < maxPerSlot,
      isBreak: Boolean(isBreak),
    };
  });

  return NextResponse.json({ ok: true, slots });
}
