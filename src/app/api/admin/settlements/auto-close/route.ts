// src/app/api/admin/settlements/auto-close/route.ts
// =======================================================
// CRON(관리자): 전월 자동 월정산 마감
// -------------------------------------------------------
// 보호:
// - CRON_SECRET 헤더 일치 필요
// - generateSettlement 서비스 사용 (새 필드 포함)
// =======================================================

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getPreviousMonthRange } from "@/lib/settlementPeriod";
import { generateSettlement } from "@/services/settlement";

export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[AUTO_CLOSE] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json(
      { ok: false, message: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (cronSecret !== expected) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized cron request" },
      { status: 401 }
    );
  }

  await connectDB();

  const { from, to, periodKey } = getPreviousMonthRange(new Date());

  // 모든 PARTNER 유저 조회 (auto-close는 CRON 전용이므로 orgId는 env로 관리 - 현재는 "default" 사용)
  const cronOrgId = process.env.CRON_ORG_ID ?? "4nwn";

  const partners = await User.find(
    { organizationId: cronOrgId, role: "PARTNER" },
    { _id: 1 }
  ).lean() as any[];

  if (partners.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: false,
      periodKey,
      from,
      to,
      totalPartners: 0,
      successCount: 0,
      errorCount: 0,
      message: "처리할 파트너가 없습니다.",
    });
  }

  let successCount = 0;
  let errorCount = 0;
  let totalUsedPoints = 0;
  let totalIssuedPoints = 0;
  let totalVisitorCount = 0;

  for (const partner of partners) {
    try {
      const result = await generateSettlement(partner._id, periodKey, cronOrgId);
      successCount++;
      totalUsedPoints += result.usedPoints;
      totalIssuedPoints += result.issuedPoints;
      totalVisitorCount += result.visitorCount;
    } catch (e: any) {
      console.error(`[AUTO_CLOSE] partner=${String(partner._id)} error:`, e?.message);
      errorCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    skipped: false,
    periodKey,
    from,
    to,
    totalPartners: partners.length,
    successCount,
    errorCount,
    totalUsedPoints,
    totalIssuedPoints,
    totalVisitorCount,
  });
}
