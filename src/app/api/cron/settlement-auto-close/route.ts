// src/app/api/cron/settlement-auto-close/route.ts
// =======================================================
// CRON: 매월 1일 자동 월정산 마감
// -------------------------------------------------------
// 보안:
//   - Authorization: Bearer <CRON_SECRET> 헤더 필요
//   - 또는 x-cron-secret 헤더
// 동작:
//   - 전달(이번 달 - 1) periodKey 계산
//   - 모든 PARTNER 유저 조회
//   - 각 파트너에 대해 generateSettlement 호출(upsert)
// =======================================================

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getPreviousMonthRange } from "@/lib/settlementPeriod";
import { generateSettlement } from "@/services/settlement";

export async function GET(req: Request) {
  // ----- 보안 검증 -----
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[CRON_SETTLEMENT] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json(
      { ok: false, message: "Server misconfiguration: CRON_SECRET not set" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (bearerToken !== expected && cronSecretHeader !== expected) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  await connectDB();

  // ----- 전달 periodKey 계산 -----
  const { periodKey, from, to } = getPreviousMonthRange(new Date());

  // ----- 모든 PARTNER 유저 조회 (org별로 포함) -----
  const partners = await User.find(
    { role: "PARTNER" },
    { _id: 1, organizationId: 1 }
  ).lean() as any[];

  if (partners.length === 0) {
    return NextResponse.json({
      ok: true,
      periodKey,
      from,
      to,
      totalPartners: 0,
      message: "처리할 파트너가 없습니다.",
    });
  }

  // ----- 각 파트너별 정산 생성(upsert) -----
  const results: Array<{
    partnerId: string;
    ok: boolean;
    error?: string;
    issuedPoints?: number;
    usedPoints?: number;
    visitorCount?: number;
    completedCount?: number;
    cancelledCount?: number;
  }> = [];

  let successCount = 0;
  let errorCount = 0;

  for (const partner of partners) {
    try {
      const result = await generateSettlement(partner._id, periodKey, partner.organizationId ?? "default");
      results.push({
        partnerId: result.counterpartyId,
        ok: true,
        issuedPoints: result.issuedPoints,
        usedPoints: result.usedPoints,
        visitorCount: result.visitorCount,
        completedCount: result.completedCount,
        cancelledCount: result.cancelledCount,
      });
      successCount++;
    } catch (e: any) {
      const msg = String(e?.message ?? "알 수 없는 오류");
      console.error(`[CRON_SETTLEMENT] partner=${String(partner._id)} error:`, msg);
      results.push({
        partnerId: String(partner._id),
        ok: false,
        error: msg,
      });
      errorCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    periodKey,
    from,
    to,
    totalPartners: partners.length,
    successCount,
    errorCount,
    results,
  });
}
