// src/app/api/cron/appointment-auto-complete/route.ts
// =======================================================
// CRON: 매일 자정 예약 자동 이용완료 처리
// -------------------------------------------------------
// 보안:
//   - Authorization: Bearer <CRON_SECRET> 헤더 필요
//   - 또는 x-cron-secret 헤더
// 동작:
//   - 이용일시(appointmentAt)가 오늘 자정 이전인 CONFIRMED 예약
//   - → COMPLETED(이용완료) 자동 전환
// =======================================================

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { FavoritePartner } from "@/models/FavoritePartner";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[CRON_APPOINTMENT_AUTO_COMPLETE] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json(
      { ok: false, message: "Server misconfiguration: CRON_SECRET not set" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (bearerToken !== expected && cronSecretHeader !== expected) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // 오늘 자정 (KST 기준 오늘 00:00:00 UTC = 전날 15:00 UTC)
  // appointmentAt이 오늘 자정 이전인 것만 완료 처리
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const now2 = new Date();
  const historyEntry = {
    status: "COMPLETED",
    label: "이용완료",
    note: "자동완료",
    at: now2,
  };

  const result = await FavoritePartner.updateMany(
    {
      appointmentStatus: "CONFIRMED",
      appointmentAt: { $lt: todayMidnight },
    },
    {
      $set: { appointmentStatus: "COMPLETED" },
      $push: { statusHistory: { $each: [historyEntry], $position: 0 } },
    }
  );

  console.log(`[CRON_APPOINTMENT_AUTO_COMPLETE] 자동완료 처리: ${result.modifiedCount}건`);

  return NextResponse.json({
    ok: true,
    completedCount: result.modifiedCount,
  });
}
