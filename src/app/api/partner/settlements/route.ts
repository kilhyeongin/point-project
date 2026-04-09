// src/app/api/partner/settlements/route.ts
// =======================================================
// PARTNER: 내 정산 목록 조회
// -------------------------------------------------------
// - 마감된 정산: Settlement 컬렉션에서 조회 (새 필드 포함)
// - 현재 달(미마감): Ledger + FavoritePartner에서 실시간 집계 후 PENDING 상태로 추가
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";
import { Ledger } from "@/models/Ledger";
import { FavoritePartner } from "@/models/FavoritePartner";

function getCurrentPeriodKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function periodKeyToDateRange(periodKey: string) {
  const [yearStr, monthStr] = periodKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const fromDate = new Date(`${periodKey}-01T00:00:00.000+09:00`);
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = new Date(
    `${periodKey}-${String(lastDay).padStart(2, "0")}T23:59:59.999+09:00`
  );
  return { fromDate, toDate };
}

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "제휴사만 접근 가능합니다." },
      { status: 403 }
    );
  }

  await connectDB();

  const counterpartyId = new mongoose.Types.ObjectId(session.uid);
  const currentPeriodKey = getCurrentPeriodKey();
  const orgId = session.orgId ?? "default";

  // ----- 마감된 정산 조회 -----
  const rows = await Settlement.find({ organizationId: orgId, counterpartyId })
    .sort({ periodKey: -1, createdAt: -1 })
    .lean() as any[];

  // 이미 정산이 있는 periodKey 집합
  const closedPeriodKeys = new Set(rows.map((r) => r.periodKey));

  // ----- 현재 달 미마감 데이터 실시간 집계 (Settlement에 없을 경우) -----
  let pendingItem: any = null;

  if (!closedPeriodKeys.has(currentPeriodKey)) {
    const { fromDate, toDate } = periodKeyToDateRange(currentPeriodKey);

    // ISSUE 집계
    const issueAgg = await Ledger.aggregate([
      {
        $match: {
          organizationId: orgId,
          actorId: counterpartyId,
          userId: { $ne: counterpartyId },
          type: "ISSUE",
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: null,
          issuedPoints: { $sum: "$amount" },
          issueCount: { $sum: 1 },
          visitorSet: { $addToSet: "$userId" },
        },
      },
    ]);

    const issuedPoints = Number(issueAgg[0]?.issuedPoints ?? 0);
    const issueCount = Number(issueAgg[0]?.issueCount ?? 0);
    const visitorCount = Array.isArray(issueAgg[0]?.visitorSet)
      ? issueAgg[0].visitorSet.length
      : 0;

    // USE 집계 (actorId 기준 우선, 없으면 counterpartyId 기준)
    let usedPoints = 0;
    let useCount = 0;

    const useAgg = await Ledger.aggregate([
      {
        $match: {
          organizationId: orgId,
          actorId: counterpartyId,
          userId: { $ne: counterpartyId },
          type: "USE",
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: null,
          usedPointsSum: { $sum: { $abs: "$amount" } },
          useCount: { $sum: 1 },
        },
      },
    ]);

    if (Number(useAgg[0]?.useCount ?? 0) > 0) {
      usedPoints = Number(useAgg[0]?.usedPointsSum ?? 0);
      useCount = Number(useAgg[0]?.useCount ?? 0);
    } else {
      const useAgg2 = await Ledger.aggregate([
        {
          $match: {
            organizationId: orgId,
            counterpartyId,
            type: "USE",
            createdAt: { $gte: fromDate, $lte: toDate },
          },
        },
        {
          $group: {
            _id: null,
            usedPointsSum: { $sum: { $abs: "$amount" } },
            useCount: { $sum: 1 },
          },
        },
      ]);
      usedPoints = Number(useAgg2[0]?.usedPointsSum ?? 0);
      useCount = Number(useAgg2[0]?.useCount ?? 0);
    }

    // FavoritePartner 집계
    const completedCount = await FavoritePartner.countDocuments({
      organizationId: orgId,
      partnerId: counterpartyId,
      appointmentStatus: "COMPLETED",
      appointmentAt: { $gte: fromDate, $lte: toDate },
    });

    const cancelledCount = await FavoritePartner.countDocuments({
      organizationId: orgId,
      partnerId: counterpartyId,
      appointmentStatus: { $in: ["CANCELLED", "NOSHOW"] },
      appointmentAt: { $gte: fromDate, $lte: toDate },
    });

    pendingItem = {
      id: `pending-${currentPeriodKey}`,
      periodKey: currentPeriodKey,
      useCount,
      usedPoints,
      issuedPoints,
      issueCount,
      visitorCount,
      completedCount,
      cancelledCount,
      netPayable: usedPoints,
      status: "PENDING",
      paidAt: null,
      payoutRef: "",
      note: "",
    };
  }

  // ----- 마감 정산 응답 변환 -----
  const closedItems = rows.map((r) => ({
    id: String(r._id),
    periodKey: r.periodKey,
    useCount: Number(r.useCount ?? 0),
    usedPoints: Number(r.usedPoints ?? 0),
    issuedPoints: Number(r.issuedPoints ?? 0),
    issueCount: Number(r.issueCount ?? 0),
    visitorCount: Number(r.visitorCount ?? 0),
    completedCount: Number(r.completedCount ?? 0),
    cancelledCount: Number(r.cancelledCount ?? 0),
    netPayable: Number(r.netPayable ?? r.usedPoints ?? 0),
    status: r.status,
    paidAt: r.paidAt ?? null,
    payoutRef: r.payoutRef ?? "",
    note: r.note ?? "",
  }));

  // 현재 달 미마감 항목을 최상단에 추가
  const items = pendingItem ? [pendingItem, ...closedItems] : closedItems;

  return NextResponse.json({ ok: true, items });
}
