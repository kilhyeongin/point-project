// src/app/api/admin/settlements/auto-close/route.ts
// =======================================================
// CRON: 전월 자동 월정산 마감
// -------------------------------------------------------
// 보호:
// - CRON_SECRET 헤더 일치 필요
// - 이미 해당 periodKey Settlement 존재 시 중복 생성 방지
// -------------------------------------------------------
// 환경변수:
// - CRON_SECRET=...
// - DEFAULT_SETTLEMENT_FEE_PERCENT=10
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
import { User } from "@/models/User";
import { Settlement } from "@/models/Settlement";
import { getPreviousMonthRange } from "@/lib/settlementPeriod";

function parseDefaultFeeRate() {
  const raw = Number(process.env.DEFAULT_SETTLEMENT_FEE_PERCENT ?? 10);

  if (!Number.isFinite(raw) || raw < 0) return 0.1;
  if (raw > 100) return 1;

  return raw / 100;
}

function toDateRange(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00.000+09:00`);
  const toDate = new Date(`${to}T23:59:59.999+09:00`);
  return { fromDate, toDate };
}

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
  const { fromDate, toDate } = toDateRange(from, to);
  const feeRate = parseDefaultFeeRate();

  const alreadyExists = await Settlement.exists({ periodKey });

  if (alreadyExists) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `${periodKey} 정산은 이미 생성되어 있습니다.`,
      periodKey,
    });
  }

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const grouped = await Ledger.aggregate([
        {
          $match: {
            type: "USE",
            counterpartyId: { $ne: null },
            createdAt: { $gte: fromDate, $lte: toDate },
          },
        },
        {
          $group: {
            _id: "$counterpartyId",
            useCount: { $sum: 1 },
            usedPoints: { $sum: { $abs: "$amount" } },
            lastUsedAt: { $max: "$createdAt" },
          },
        },
      ]).session(dbSession);

      let totalCounterparties = 0;
      let totalUseCount = 0;
      let totalUsedPoints = 0;

      // 파트너 정보 일괄 조회 (N+1 방지)
      const counterpartyIds = grouped
        .map((row: any) => row?._id ? new mongoose.Types.ObjectId(String(row._id)) : null)
        .filter(Boolean) as mongoose.Types.ObjectId[];

      const counterpartyDocs = await User.find(
        { _id: { $in: counterpartyIds } },
        { _id: 1, username: 1, name: 1, role: 1, status: 1 }
      ).session(dbSession).lean();

      const counterpartyMap = new Map<string, any>();
      for (const doc of counterpartyDocs as any[]) {
        counterpartyMap.set(String(doc._id), doc);
      }

      const settlementDocs: any[] = [];

      for (const row of grouped) {
        const counterpartyId = row?._id
          ? new mongoose.Types.ObjectId(String(row._id))
          : null;

        if (!counterpartyId) continue;

        const counterparty = counterpartyMap.get(String(counterpartyId)) ?? null;

        const useCount = Number(row?.useCount ?? 0);
        const usedPoints = Number(row?.usedPoints ?? 0);
        // 부동소수점 오차 방지: 정수 연산 후 나누기
        const feeAmount = Math.floor((usedPoints * Math.round(feeRate * 10000)) / 10000);
        const netPayable = usedPoints - feeAmount;

        settlementDocs.push({
          periodKey,
          from,
          to,
          counterpartyId,
          counterpartySnapshot: counterparty
            ? {
                id: String(counterparty._id),
                username: counterparty.username,
                name: counterparty.name,
                role: counterparty.role,
                status: counterparty.status,
              }
            : null,
          useCount,
          usedPoints,
          feeRate,
          feeAmount,
          netPayable,
          lastUsedAt: row?.lastUsedAt ?? null,
          status: "OPEN",
          closedAt: new Date(),
          paidAt: null,
          payoutRef: "",
          note: "자동 월정산 생성",
        });

        totalCounterparties += 1;
        totalUseCount += useCount;
        totalUsedPoints += usedPoints;
      }

      // 배치 삽입 (순차 create 대신 insertMany)
      if (settlementDocs.length > 0) {
        await Settlement.insertMany(settlementDocs, { session: dbSession });
      }

      return {
        ok: true as const,
        skipped: false,
        periodKey,
        from,
        to,
        feeRate,
        totalCounterparties,
        totalUseCount,
        totalUsedPoints,
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: String(e?.message ?? "자동 월정산 실패") },
      { status: 500 }
    );
  } finally {
    dbSession.endSession();
  }
}