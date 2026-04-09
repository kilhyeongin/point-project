// src/app/api/customer/applications/[partnerId]/route.ts
// =======================================================
// CUSTOMER: 제휴사 신청 처리
// -------------------------------------------------------
// - POST  : 신청 (FavoritePartner → APPLIED)
// - DELETE: 취소 (APPLIED → LIKED, 이력 기록)
// - PATCH : 변경 (appointmentAt 교체, 이력 기록)
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FavoritePartner } from "@/models/FavoritePartner";
import { User } from "@/models/User";
import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { isKoreanHoliday, getHolidayName } from "@/lib/koreanHolidays";

type Params = {
  params: Promise<{ partnerId: string }>;
};

export async function POST(req: Request, { params }: Params) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "CUSTOMER") {
    return NextResponse.json(
      { ok: false, message: "고객만 신청할 수 있습니다." },
      { status: 403 }
    );
  }

  const { partnerId } = await params;

  if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
    return NextResponse.json(
      { ok: false, message: "잘못된 업체 ID입니다." },
      { status: 400 }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 본문을 파싱할 수 없습니다." },
      { status: 400 }
    );
  }

  const rawAppointmentAt = (body as any)?.appointmentAt;
  const rawNote = String((body as any)?.appointmentNote ?? "").trim().slice(0, 200);

  if (!rawAppointmentAt) {
    return NextResponse.json(
      { ok: false, message: "방문 희망 날짜/시간을 입력해 주세요." },
      { status: 400 }
    );
  }

  const parsedDate = new Date(rawAppointmentAt);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json(
      { ok: false, message: "유효하지 않은 날짜 형식입니다." },
      { status: 400 }
    );
  }

  if (parsedDate.getTime() <= Date.now()) {
    return NextResponse.json(
      { ok: false, message: "방문 희망 날짜는 미래 날짜여야 합니다." },
      { status: 400 }
    );
  }

  const appointmentDate = parsedDate;
  const noteText = rawNote;

  await connectDB();

  const partnerObjectId = new mongoose.Types.ObjectId(partnerId);
  const customerId = new mongoose.Types.ObjectId(session.uid);

  const partner = await User.findOne(
    {
      _id: partnerObjectId,
      organizationId: session.orgId ?? "default",
      role: "PARTNER",
      status: "ACTIVE",
      "partnerProfile.isPublished": true,
    },
    {
      _id: 1,
      name: 1,
      email: 1,
      "partnerProfile.contactEmail": 1,
      "partnerProfile.businessName": 1,
      "partnerProfile.contactName": 1,
      "partnerProfile.operatingDays": 1,
      "partnerProfile.openTime": 1,
      "partnerProfile.closeTime": 1,
      "partnerProfile.slotMinutes": 1,
      "partnerProfile.maxPerSlot": 1,
      "partnerProfile.advanceDays": 1,
      "partnerProfile.breakStart": 1,
      "partnerProfile.breakEnd": 1,
      "partnerProfile.closedOnHolidays": 1,
      "partnerProfile.blockedDates": 1,
    }
  ).lean();

  if (!partner) {
    return NextResponse.json(
      { ok: false, message: "신청할 수 없는 업체입니다." },
      { status: 404 }
    );
  }

  // ── 슬롯 유효성 및 중복 예약 검증 ──────────────────────────
  const pp = (partner as any).partnerProfile ?? {};
  const operatingDays: number[] = Array.isArray(pp.operatingDays) ? pp.operatingDays : [1,2,3,4,5];
  const openTime: string = pp.openTime ?? "09:00";
  const closeTime: string = pp.closeTime ?? "18:00";
  const slotMinutes: number = Number(pp.slotMinutes ?? 30);
  const maxPerSlot: number = Number(pp.maxPerSlot ?? 1);
  const advanceDays: number = Number(pp.advanceDays ?? 30);
  const breakStart: string = String(pp.breakStart ?? "12:00");
  const breakEnd: string = String(pp.breakEnd ?? "13:00");
  const closedOnHolidays: boolean = Boolean(pp.closedOnHolidays ?? true);
  const blockedDates: string[] = Array.isArray(pp.blockedDates) ? pp.blockedDates : [];

  // 요일 체크 (KST 기준)
  const kstDate = new Date(appointmentDate.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstDate.getUTCDay(); // KST 기준 요일
  if (!operatingDays.includes(dayOfWeek)) {
    return NextResponse.json(
      { ok: false, message: "해당 요일은 운영하지 않습니다." },
      { status: 400 }
    );
  }

  // 공휴일 체크
  const kstDateStr = `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, "0")}-${String(kstDate.getUTCDate()).padStart(2, "0")}`;
  if (closedOnHolidays && isKoreanHoliday(kstDateStr)) {
    return NextResponse.json(
      { ok: false, message: `${getHolidayName(kstDateStr)}은(는) 휴무일입니다.` },
      { status: 400 }
    );
  }

  // 특정 휴무일 체크
  if (blockedDates.includes(kstDateStr)) {
    return NextResponse.json(
      { ok: false, message: "해당 날짜는 특별 휴무일입니다." },
      { status: 400 }
    );
  }

  // 예약 가능 기간 체크
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const maxAllowedDate = new Date(todayStart);
  maxAllowedDate.setDate(maxAllowedDate.getDate() + advanceDays);
  if (appointmentDate < todayStart || appointmentDate > maxAllowedDate) {
    return NextResponse.json(
      { ok: false, message: "예약 가능 기간이 아닙니다." },
      { status: 400 }
    );
  }

  // 운영 시간 체크 (KST HH:MM)
  const kstHour = kstDate.getUTCHours();
  const kstMin = kstDate.getUTCMinutes();
  const apptMinutes = kstHour * 60 + kstMin;
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  const openMin = toMin(openTime);
  const closeMin = toMin(closeTime);
  if (apptMinutes < openMin || apptMinutes >= closeMin) {
    return NextResponse.json(
      { ok: false, message: `운영 시간(${openTime}~${closeTime}) 내의 시간을 선택해 주세요.` },
      { status: 400 }
    );
  }

  // 슬롯 경계 체크 (30분 단위이면 :00 또는 :30이어야 함)
  if ((apptMinutes - openMin) % slotMinutes !== 0) {
    return NextResponse.json(
      { ok: false, message: `${slotMinutes}분 단위 슬롯으로 선택해 주세요.` },
      { status: 400 }
    );
  }

  // 휴무시간 체크
  if (breakStart && breakEnd) {
    const toMin2 = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
    const breakStartMin = toMin2(breakStart);
    const breakEndMin = toMin2(breakEnd);
    if (apptMinutes >= breakStartMin && apptMinutes < breakEndMin) {
      return NextResponse.json(
        { ok: false, message: `${breakStart}~${breakEnd}는 휴무 시간입니다. 다른 시간을 선택해 주세요.` },
        { status: 400 }
      );
    }
  }

  // 슬롯 시간 범위
  const slotEnd = new Date(appointmentDate.getTime() + slotMinutes * 60 * 1000);

  // 이미 예약된 수 확인 (내 기존 예약 제외)
  const bookedCount = await FavoritePartner.countDocuments({
    organizationId: session.orgId ?? "default",
    partnerId: partnerObjectId,
    customerId: { $ne: customerId },   // 본인 제외 (재신청 허용)
    status: "APPLIED",
    appointmentAt: { $gte: appointmentDate, $lt: slotEnd },
  });

  if (bookedCount >= maxPerSlot) {
    return NextResponse.json(
      { ok: false, message: "해당 시간은 이미 예약이 마감되었습니다. 다른 시간을 선택해 주세요." },
      { status: 409 }
    );
  }
  // ─────────────────────────────────────────────────────────

  const customer = await User.findOne({ _id: customerId, organizationId: session.orgId ?? "default" }, {
    name: 1,
    "customerProfile.phone": 1,
    "customerProfile.address": 1,
  }).lean();

  const now = new Date();

  await FavoritePartner.updateOne(
    {
      organizationId: session.orgId ?? "default",
      customerId,
      partnerId: partnerObjectId,
    },
    {
      $set: {
        status: "APPLIED",
        likedByCustomer: true,
        appliedAt: now,
        appointmentAt: appointmentDate,
        appointmentNote: noteText,
      },
      $push: {
        appointmentHistory: {
          action: "APPLIED",
          appointmentAt: appointmentDate,
          appointmentNote: noteText,
          previousAppointmentAt: null,
          createdAt: now,
        },
      },
      $setOnInsert: {
        organizationId: session.orgId ?? "default",
        customerId,
        partnerId: partnerObjectId,
      },
    },
    {
      upsert: true,
    }
  );

  // Send notification email to partner
  const partnerAny = partner as any;
  const partnerEmail =
    partnerAny.partnerProfile?.contactEmail || partnerAny.email;

  if (partnerEmail) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const customerAny = customer as any;
      const customerName = String(customerAny?.name ?? "고객");
      const customerPhone = String(customerAny?.customerProfile?.phone ?? "-");
      const customerAddress = String(customerAny?.customerProfile?.address ?? "-");

      const appointmentKorean = appointmentDate.toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      });

      const noteHtml = noteText
        ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">추가 메모</td><td style="padding:8px 0;font-size:14px;">${noteText}</td></tr>`
        : "";

      await resend.emails.send({
        from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
        to: partnerEmail,
        subject: "[포인트 관리 시스템] 새로운 신청이 도착했습니다",
        html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="font-size:20px;font-weight:800;margin-bottom:16px;">새로운 신청이 도착했습니다</h2>
  <p style="color:#374151;font-size:15px;margin-bottom:20px;">
    고객이 귀사에 방문을 신청하였습니다. 아래 정보를 확인해 주세요.
  </p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;width:120px;">고객명</td>
      <td style="padding:8px 0;font-size:14px;font-weight:700;">${customerName}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;">방문 희망 일시</td>
      <td style="padding:8px 0;font-size:14px;font-weight:700;">${appointmentKorean}</td>
    </tr>
    ${noteHtml}
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;">연락처</td>
      <td style="padding:8px 0;font-size:14px;">${customerPhone}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;">주소</td>
      <td style="padding:8px 0;font-size:14px;">${customerAddress}</td>
    </tr>
  </table>
  <p style="color:#9ca3af;font-size:12px;">이 메일은 포인트 관리 시스템에서 자동 발송되었습니다.</p>
</div>
        `.trim(),
      });
    } catch (emailErr) {
      logger.error("[APPLICATIONS_POST_EMAIL_ERROR]", emailErr);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      partnerId,
      status: "APPLIED",
      appliedAt: now,
      appointmentAt: appointmentDate,
      message: "제휴사 신청이 완료되었습니다.",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

// ─── 공통: 세션/파트너 검증 헬퍼 ─────────────────────────────
async function validateCustomerAndPartner(partnerId: string) {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 }) };
  if (session.role !== "CUSTOMER") return { error: NextResponse.json({ ok: false, message: "고객만 가능합니다." }, { status: 403 }) };
  if (!mongoose.Types.ObjectId.isValid(partnerId)) return { error: NextResponse.json({ ok: false, message: "잘못된 업체 ID입니다." }, { status: 400 }) };

  await connectDB();
  const partner = await User.findOne(
    { _id: partnerId, organizationId: session.orgId ?? "default", role: "PARTNER", status: "ACTIVE" },
    { _id: 1, name: 1, email: 1, "partnerProfile.contactEmail": 1, "partnerProfile.businessName": 1 }
  ).lean();

  if (!partner) return { error: NextResponse.json({ ok: false, message: "업체를 찾을 수 없습니다." }, { status: 404 }) };

  return { session, partner };
}

// ─── 공통: 파트너 이메일 발송 ─────────────────────────────────
async function sendPartnerEmail(partnerAny: Record<string, unknown>, subject: string, html: string) {
  const partnerEmail = (partnerAny?.partnerProfile as Record<string, unknown>)?.contactEmail || partnerAny?.email;
  if (!partnerEmail) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
      to: String(partnerEmail),
      subject,
      html,
    });
  } catch (err) {
    logger.error("[APPLICATIONS_EMAIL_ERROR]", err);
  }
}

// ─── DELETE: 신청 취소 ────────────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const { partnerId } = await params;
  const validated = await validateCustomerAndPartner(partnerId);
  if ("error" in validated) return validated.error;
  const { session, partner } = validated;

  const customerId = new mongoose.Types.ObjectId(session.uid);
  const partnerObjectId = new mongoose.Types.ObjectId(partnerId);

  const record = await FavoritePartner.findOne({ organizationId: session.orgId ?? "default", customerId, partnerId: partnerObjectId });

  if (!record || record.status !== "APPLIED") {
    return NextResponse.json({ ok: false, message: "취소할 수 있는 신청이 없습니다." }, { status: 404 });
  }

  const cancelledAt = record.appointmentAt;
  const cancelledNote = record.appointmentNote ?? "";

  await FavoritePartner.updateOne(
    { organizationId: session.orgId ?? "default", customerId, partnerId: partnerObjectId },
    {
      $set: { status: "LIKED", appointmentAt: null, appointmentNote: "" },
      $push: {
        appointmentHistory: {
          action: "CANCELLED",
          appointmentAt: cancelledAt,
          appointmentNote: cancelledNote,
          previousAppointmentAt: null,
          createdAt: new Date(),
        },
      },
    }
  );

  const partnerAny = partner as Record<string, unknown>;
  const businessName = String((partnerAny?.partnerProfile as Record<string, unknown>)?.businessName ?? (partnerAny?.name ?? ""));
  const apptKorean = cancelledAt
    ? new Date(cancelledAt).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })
    : "-";

  await sendPartnerEmail(
    partnerAny,
    "[포인트 관리 시스템] 신청이 취소되었습니다",
    `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="font-size:20px;font-weight:800;margin-bottom:16px;">신청이 취소되었습니다</h2>
  <p style="color:#374151;font-size:15px;margin-bottom:20px;">
    고객이 <strong>${businessName}</strong> 방문 신청을 취소하였습니다.
  </p>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;">취소된 방문 일시</td>
      <td style="padding:8px 0;font-size:14px;font-weight:700;">${apptKorean}</td>
    </tr>
  </table>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">이 메일은 포인트 관리 시스템에서 자동 발송되었습니다.</p>
</div>`.trim()
  );

  return NextResponse.json({ ok: true, message: "신청이 취소되었습니다." });
}

// ─── PATCH: 신청 변경 ─────────────────────────────────────────
export async function PATCH(req: Request, { params }: Params) {
  const { partnerId } = await params;
  const validated = await validateCustomerAndPartner(partnerId);
  if ("error" in validated) return validated.error;
  const { session, partner } = validated;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, message: "요청 본문을 파싱할 수 없습니다." }, { status: 400 });
  }

  const rawAppointmentAt = (body as Record<string, unknown>)?.appointmentAt;
  const rawNote = String((body as Record<string, unknown>)?.appointmentNote ?? "").trim().slice(0, 200);

  if (!rawAppointmentAt) {
    return NextResponse.json({ ok: false, message: "변경할 방문 날짜/시간을 입력해 주세요." }, { status: 400 });
  }

  const newDate = new Date(String(rawAppointmentAt));
  if (isNaN(newDate.getTime())) {
    return NextResponse.json({ ok: false, message: "유효하지 않은 날짜 형식입니다." }, { status: 400 });
  }
  if (newDate.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, message: "방문 날짜는 미래 날짜여야 합니다." }, { status: 400 });
  }

  const customerId = new mongoose.Types.ObjectId(session.uid);
  const partnerObjectId = new mongoose.Types.ObjectId(partnerId);

  const record = await FavoritePartner.findOne({ organizationId: session.orgId ?? "default", customerId, partnerId: partnerObjectId });
  if (!record || record.status !== "APPLIED") {
    return NextResponse.json({ ok: false, message: "변경할 수 있는 신청이 없습니다." }, { status: 404 });
  }

  // 파트너 스케줄 유효성 검증 (POST와 동일 로직)
  const fullPartner = await User.findOne(
    { _id: partnerObjectId, organizationId: session.orgId ?? "default" },
    {
      "partnerProfile.operatingDays": 1, "partnerProfile.openTime": 1, "partnerProfile.closeTime": 1,
      "partnerProfile.slotMinutes": 1, "partnerProfile.maxPerSlot": 1, "partnerProfile.advanceDays": 1,
      "partnerProfile.breakStart": 1, "partnerProfile.breakEnd": 1,
      "partnerProfile.closedOnHolidays": 1, "partnerProfile.blockedDates": 1,
    }
  ).lean();

  const pp = (fullPartner as Record<string, unknown>)?.partnerProfile as Record<string, unknown> ?? {};
  const operatingDays: number[] = Array.isArray(pp.operatingDays) ? pp.operatingDays as number[] : [1,2,3,4,5];
  const openTime = String(pp.openTime ?? "09:00");
  const closeTime = String(pp.closeTime ?? "18:00");
  const slotMinutes = Number(pp.slotMinutes ?? 30);
  const maxPerSlot = Number(pp.maxPerSlot ?? 1);
  const advanceDays = Number(pp.advanceDays ?? 30);
  const breakStart = String(pp.breakStart ?? "12:00");
  const breakEnd = String(pp.breakEnd ?? "13:00");
  const closedOnHolidays = Boolean(pp.closedOnHolidays ?? true);
  const blockedDates: string[] = Array.isArray(pp.blockedDates) ? pp.blockedDates as string[] : [];

  const kstDate = new Date(newDate.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstDate.getUTCDay();
  if (!operatingDays.includes(dayOfWeek)) {
    return NextResponse.json({ ok: false, message: "해당 요일은 운영하지 않습니다." }, { status: 400 });
  }

  const kstDateStr = `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth()+1).padStart(2,"0")}-${String(kstDate.getUTCDate()).padStart(2,"0")}`;
  if (closedOnHolidays && isKoreanHoliday(kstDateStr)) {
    return NextResponse.json({ ok: false, message: `${getHolidayName(kstDateStr)}은(는) 휴무일입니다.` }, { status: 400 });
  }
  if (blockedDates.includes(kstDateStr)) {
    return NextResponse.json({ ok: false, message: "해당 날짜는 특별 휴무일입니다." }, { status: 400 });
  }

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const maxAllowed = new Date(todayStart); maxAllowed.setDate(maxAllowed.getDate() + advanceDays);
  if (newDate < todayStart || newDate > maxAllowed) {
    return NextResponse.json({ ok: false, message: "예약 가능 기간이 아닙니다." }, { status: 400 });
  }

  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  const apptMinutes = kstDate.getUTCHours() * 60 + kstDate.getUTCMinutes();
  const openMin = toMin(openTime); const closeMin = toMin(closeTime);
  if (apptMinutes < openMin || apptMinutes >= closeMin) {
    return NextResponse.json({ ok: false, message: `운영 시간(${openTime}~${closeTime}) 내의 시간을 선택해 주세요.` }, { status: 400 });
  }
  if ((apptMinutes - openMin) % slotMinutes !== 0) {
    return NextResponse.json({ ok: false, message: `${slotMinutes}분 단위 슬롯으로 선택해 주세요.` }, { status: 400 });
  }
  if (breakStart && breakEnd && apptMinutes >= toMin(breakStart) && apptMinutes < toMin(breakEnd)) {
    return NextResponse.json({ ok: false, message: `${breakStart}~${breakEnd}는 휴무 시간입니다.` }, { status: 400 });
  }

  // 슬롯 중복 확인 (본인 제외)
  const slotEnd = new Date(newDate.getTime() + slotMinutes * 60 * 1000);
  const bookedCount = await FavoritePartner.countDocuments({
    organizationId: session.orgId ?? "default",
    partnerId: partnerObjectId,
    customerId: { $ne: customerId },
    status: "APPLIED",
    appointmentAt: { $gte: newDate, $lt: slotEnd },
  });
  if (bookedCount >= maxPerSlot) {
    return NextResponse.json({ ok: false, message: "해당 시간은 이미 예약이 마감되었습니다. 다른 시간을 선택해 주세요." }, { status: 409 });
  }

  const previousAppointmentAt = record.appointmentAt;

  await FavoritePartner.updateOne(
    { organizationId: session.orgId ?? "default", customerId, partnerId: partnerObjectId },
    {
      $set: { appointmentAt: newDate, appointmentNote: rawNote },
      $push: {
        appointmentHistory: {
          action: "CHANGED",
          appointmentAt: newDate,
          appointmentNote: rawNote,
          previousAppointmentAt,
          createdAt: new Date(),
        },
      },
    }
  );

  const partnerAny = partner as Record<string, unknown>;
  const businessName = String((partnerAny?.partnerProfile as Record<string, unknown>)?.businessName ?? (partnerAny?.name ?? ""));
  const newKorean = newDate.toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
  const prevKorean = previousAppointmentAt
    ? new Date(previousAppointmentAt).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })
    : "-";

  await sendPartnerEmail(
    partnerAny,
    "[포인트 관리 시스템] 방문 일정이 변경되었습니다",
    `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="font-size:20px;font-weight:800;margin-bottom:16px;">방문 일정이 변경되었습니다</h2>
  <p style="color:#374151;font-size:15px;margin-bottom:20px;">
    고객이 <strong>${businessName}</strong> 방문 일정을 변경하였습니다.
  </p>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;">기존 방문 일시</td>
      <td style="padding:8px 0;font-size:14px;text-decoration:line-through;color:#9ca3af;">${prevKorean}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;">변경된 방문 일시</td>
      <td style="padding:8px 0;font-size:14px;font-weight:700;">${newKorean}</td>
    </tr>
    ${rawNote ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">메모</td><td style="padding:8px 0;font-size:14px;">${rawNote}</td></tr>` : ""}
  </table>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">이 메일은 포인트 관리 시스템에서 자동 발송되었습니다.</p>
</div>`.trim()
  );

  return NextResponse.json({ ok: true, message: "방문 일정이 변경되었습니다.", appointmentAt: newDate });
}
