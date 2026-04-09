// src/services/settlement.ts
// =======================================================
// 정산 생성 서비스
// -------------------------------------------------------
// generateSettlement(partnerId, periodKey):
//   - Ledger에서 ISSUE/USE 집계
//   - FavoritePartner에서 계약완료/취소 건수 집계
//   - Settlement upsert
// =======================================================

import mongoose from "mongoose";
import { Ledger } from "@/models/Ledger";
import { Settlement } from "@/models/Settlement";
import { FavoritePartner } from "@/models/FavoritePartner";
import { User } from "@/models/User";

/**
 * periodKey → { from, to } Date 범위 반환 (KST 기준)
 * periodKey 형식: "2026-03"
 */
function periodKeyToDateRange(periodKey: string) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    throw new Error(`Invalid periodKey format: ${periodKey}`);
  }

  const [yearStr, monthStr] = periodKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-based

  // 해당 월 1일 00:00:00 KST
  const fromDate = new Date(`${periodKey}-01T00:00:00.000+09:00`);

  // 해당 월 말일 23:59:59.999 KST
  const lastDay = new Date(year, month, 0).getDate(); // month is 1-based, so new Date(year, month, 0) gives last day
  const toDate = new Date(
    `${periodKey}-${String(lastDay).padStart(2, "0")}T23:59:59.999+09:00`
  );

  const fromStr = `${periodKey}-01`;
  const toStr = `${periodKey}-${String(lastDay).padStart(2, "0")}`;

  return { fromDate, toDate, fromStr, toStr };
}

export interface GenerateSettlementResult {
  periodKey: string;
  counterpartyId: string;
  issuedPoints: number;
  issueCount: number;
  visitorCount: number;
  usedPoints: number;
  useCount: number;
  completedCount: number;
  cancelledCount: number;
  netPayable: number;
  upserted: boolean;
}

/**
 * 특정 파트너의 특정 월 정산을 생성(upsert)한다.
 *
 * @param partnerId - string 또는 ObjectId
 * @param periodKey - "YYYY-MM" 형식
 */
export async function generateSettlement(
  partnerId: string | mongoose.Types.ObjectId,
  periodKey: string,
  orgId: string = "default"
): Promise<GenerateSettlementResult> {
  const partnerOid =
    typeof partnerId === "string"
      ? new mongoose.Types.ObjectId(partnerId)
      : partnerId;

  const { fromDate, toDate, fromStr, toStr } = periodKeyToDateRange(periodKey);

  // ----- 1. Ledger ISSUE 집계 -----
  // actorId=partnerId, userId≠partnerId, type=ISSUE, createdAt in range
  const issueAgg = await Ledger.aggregate([
    {
      $match: {
        organizationId: orgId,
        actorId: partnerOid,
        userId: { $ne: partnerOid },
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

  // ----- 2. Ledger USE 집계 -----
  // actorId=partnerId, userId≠partnerId, type=USE, createdAt in range
  // USE는 amount가 음수(고객 차감)이므로 abs 처리
  const useAgg = await Ledger.aggregate([
    {
      $match: {
        organizationId: orgId,
        actorId: partnerOid,
        userId: { $ne: partnerOid },
        type: "USE",
        createdAt: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $group: {
        _id: null,
        usedPointsSum: { $sum: { $abs: "$amount" } },
        useCount: { $sum: 1 },
        lastUsedAt: { $max: "$createdAt" },
      },
    },
  ]);

  // USE가 actorId=partnerId로 기록되지 않는 경우 counterpartyId 기준으로 fallback
  let usedPoints = Number(useAgg[0]?.usedPointsSum ?? 0);
  let useCount = Number(useAgg[0]?.useCount ?? 0);
  let lastUsedAt: Date | null = useAgg[0]?.lastUsedAt ?? null;

  if (useCount === 0) {
    const useAgg2 = await Ledger.aggregate([
      {
        $match: {
          organizationId: orgId,
          counterpartyId: partnerOid,
          type: "USE",
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: null,
          usedPointsSum: { $sum: { $abs: "$amount" } },
          useCount: { $sum: 1 },
          lastUsedAt: { $max: "$createdAt" },
        },
      },
    ]);
    usedPoints = Number(useAgg2[0]?.usedPointsSum ?? 0);
    useCount = Number(useAgg2[0]?.useCount ?? 0);
    lastUsedAt = useAgg2[0]?.lastUsedAt ?? null;
  }

  // ----- 3. FavoritePartner 계약 집계 -----
  const completedCount = await FavoritePartner.countDocuments({
    organizationId: orgId,
    partnerId: partnerOid,
    appointmentStatus: "COMPLETED",
    appointmentAt: { $gte: fromDate, $lte: toDate },
  });

  const cancelledCount = await FavoritePartner.countDocuments({
    organizationId: orgId,
    partnerId: partnerOid,
    appointmentStatus: { $in: ["CANCELLED", "NOSHOW"] },
    appointmentAt: { $gte: fromDate, $lte: toDate },
  });

  // ----- 4. 파트너 스냅샷 -----
  const partnerDoc = await User.findOne({ _id: partnerOid, organizationId: orgId }, {
    _id: 1,
    username: 1,
    name: 1,
    role: 1,
    status: 1,
  }).lean() as any;

  const counterpartySnapshot = partnerDoc
    ? {
        id: String(partnerDoc._id),
        username: partnerDoc.username ?? "",
        name: partnerDoc.name ?? "",
        role: partnerDoc.role ?? "",
        status: partnerDoc.status ?? "",
      }
    : null;

  // ----- 5. Settlement upsert -----
  const netPayable = usedPoints; // 수수료 없음

  const filter = { organizationId: orgId, periodKey, counterpartyId: partnerOid };
  const update = {
    $set: {
      from: fromStr,
      to: toStr,
      counterpartySnapshot,
      issuedPoints,
      issueCount,
      visitorCount,
      useCount,
      usedPoints,
      completedCount,
      cancelledCount,
      feeRate: 0,
      feeAmount: 0,
      netPayable,
      lastUsedAt,
      closedAt: new Date(),
    },
    $setOnInsert: {
      status: "OPEN",
      paidAt: null,
      payoutRef: "",
      note: "자동 월정산 생성",
    },
  };

  const existing = await Settlement.findOne(filter).lean();
  await Settlement.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
  });

  return {
    periodKey,
    counterpartyId: String(partnerOid),
    issuedPoints,
    issueCount,
    visitorCount,
    usedPoints,
    useCount,
    completedCount,
    cancelledCount,
    netPayable,
    upserted: !existing,
  };
}
