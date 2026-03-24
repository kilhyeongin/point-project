// src/app/api/partner/schedule/route.ts
// GET  : 내 예약 스케줄 설정 조회
// PUT  : 내 예약 스케줄 설정 저장

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

const VALID_SLOT_MINUTES = [15, 30, 60, 120];

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  await connectDB();

  const user = await User.findById(session.uid, { partnerProfile: 1 }).lean();
  const p = (user as any)?.partnerProfile ?? {};

  return NextResponse.json({
    ok: true,
    schedule: {
      scheduleEnabled: Boolean(p.scheduleEnabled ?? false),
      operatingDays: Array.isArray(p.operatingDays) ? p.operatingDays : [1, 2, 3, 4, 5],
      openTime: String(p.openTime ?? "09:00"),
      closeTime: String(p.closeTime ?? "18:00"),
      slotMinutes: Number(p.slotMinutes ?? 30),
      maxPerSlot: Number(p.maxPerSlot ?? 1),
      advanceDays: Number(p.advanceDays ?? 30),
      breakStart: String(p.breakStart ?? "12:00"),
      breakEnd: String(p.breakEnd ?? "13:00"),
      closedOnHolidays: Boolean(p.closedOnHolidays ?? true),
      blockedDates: Array.isArray(p.blockedDates) ? p.blockedDates : [],
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  const body = await req.json();

  const scheduleEnabled = Boolean(body?.scheduleEnabled ?? false);
  const operatingDays: number[] = (Array.isArray(body?.operatingDays) ? body.operatingDays : [1, 2, 3, 4, 5])
    .filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6);
  const openTime = String(body?.openTime ?? "09:00").slice(0, 5);
  const closeTime = String(body?.closeTime ?? "18:00").slice(0, 5);
  const slotMinutes = VALID_SLOT_MINUTES.includes(Number(body?.slotMinutes))
    ? Number(body.slotMinutes)
    : 30;
  const maxPerSlot = Math.max(1, Math.min(99, Number(body?.maxPerSlot ?? 1)));
  const advanceDays = Math.max(1, Math.min(365, Number(body?.advanceDays ?? 30)));

  if (operatingDays.length === 0) {
    return NextResponse.json({ ok: false, message: "운영 요일을 최소 1개 이상 선택해주세요." }, { status: 400 });
  }
  if (openTime >= closeTime) {
    return NextResponse.json({ ok: false, message: "시작 시간은 종료 시간보다 이전이어야 합니다." }, { status: 400 });
  }

  // 휴무시간 유효성 검사
  const breakStart = String(body?.breakStart ?? "").slice(0, 5);
  const breakEnd = String(body?.breakEnd ?? "").slice(0, 5);
  if (breakStart && breakEnd) {
    if (breakStart >= breakEnd) {
      return NextResponse.json({ ok: false, message: "휴무 시작 시간은 종료 시간보다 이전이어야 합니다." }, { status: 400 });
    }
    if (breakStart < openTime || breakEnd > closeTime) {
      return NextResponse.json({ ok: false, message: "휴무 시간은 운영 시간 내에 있어야 합니다." }, { status: 400 });
    }
  }

  await connectDB();

  await User.updateOne(
    { _id: session.uid },
    {
      $set: {
        "partnerProfile.scheduleEnabled": scheduleEnabled,
        "partnerProfile.operatingDays": operatingDays,
        "partnerProfile.openTime": openTime,
        "partnerProfile.closeTime": closeTime,
        "partnerProfile.slotMinutes": slotMinutes,
        "partnerProfile.maxPerSlot": maxPerSlot,
        "partnerProfile.advanceDays": advanceDays,
        "partnerProfile.breakStart": breakStart,
        "partnerProfile.breakEnd": breakEnd,
        "partnerProfile.closedOnHolidays": Boolean(body?.closedOnHolidays ?? true),
        "partnerProfile.blockedDates": Array.isArray(body?.blockedDates)
          ? body.blockedDates.filter((d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 365)
          : [],
      },
    }
  );

  return NextResponse.json({ ok: true, message: "예약 설정이 저장되었습니다." });
}
