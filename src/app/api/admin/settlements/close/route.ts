// src/app/api/admin/settlements/close/route.ts
// =======================================================
// ADMIN 월정산 마감(LOCK)
// -------------------------------------------------------
// - useCount, usedPoints: Ledger USE 기준
// - issuedPoints, issueCount, visitorCount: Ledger ISSUE 기준
// - completedCount, cancelledCount: FavoritePartner 기준
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
import { User } from "@/models/User";
import { Settlement } from "@/models/Settlement";
import { FavoritePartner } from "@/models/FavoritePartner";

function parseDateRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false as const, message: "from, to는 YYYY-MM-DD 형식이어야 합니다." };
  }

  const fromDate = new Date(`${from}T00:00:00.000+09:00`);
  const toDate = new Date(`${to}T23:59:59.999+09:00`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return { ok: false as const, message: "날짜 형식이 올바르지 않습니다." };
  }

  if (fromDate > toDate) {
    return { ok: false as const, message: "from은 to보다 이후일 수 없습니다." };
  }

  return { ok: true as const, fromDate, toDate };
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, message: "관리자만 접근 가능합니다." },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const periodKey = String(body?.periodKey ?? "").trim();
  const from = String(body?.from ?? "").trim();
  const to = String(body?.to ?? "").trim();

  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    return NextResponse.json(
      { ok: false, message: "periodKey는 YYYY-MM 형식이어야 합니다." },
      { status: 400 }
    );
  }

  const dateRange = parseDateRange(from, to);
  if (!dateRange.ok) {
    return NextResponse.json(
      { ok: false, message: dateRange.message },
      { status: 400 }
    );
  }

  const { fromDate, toDate } = dateRange;

  const orgId = session.orgId ?? "4nwn";

  await connectDB();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      // 이미 PAID 라인이 하나라도 있으면 재마감 금지
      const paidExists = await Settlement.exists({
        organizationId: orgId,
        periodKey,
        status: "PAID",
      }).session(dbSession);

      if (paidExists) {
        throw new Error("이미 지급완료(PAID)된 정산 기간은 다시 마감할 수 없습니다.");
      }

      // ----- USE 집계 -----
      const useGrouped = await Ledger.aggregate([
        {
          $match: {
            organizationId: orgId,
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

      // ----- ISSUE 집계 (파트너 차감행만: accountId=파트너, amount<0) -----
      const issueGrouped = await Ledger.aggregate([
        {
          $match: {
            organizationId: orgId,
            type: "ISSUE",
            accountId: { $ne: null },
            amount: { $lt: 0 },
            createdAt: { $gte: fromDate, $lte: toDate },
          },
        },
        {
          $group: {
            _id: "$accountId",
            issuedPoints: { $sum: { $abs: "$amount" } },
            issueCount: { $sum: 1 },
            visitorSet: { $addToSet: "$userId" },
          },
        },
      ]).session(dbSession);

      const issueMap = new Map<string, {
        issuedPoints: number;
        issueCount: number;
        visitorCount: number;
      }>();
      for (const row of issueGrouped) {
        issueMap.set(String(row._id), {
          issuedPoints: Number(row.issuedPoints ?? 0),
          issueCount: Number(row.issueCount ?? 0),
          visitorCount: Array.isArray(row.visitorSet) ? row.visitorSet.length : 0,
        });
      }

      // ----- FavoritePartner 집계 -----
      const completedGrouped = await FavoritePartner.aggregate([
        {
          $match: {
            organizationId: orgId,
            appointmentStatus: "COMPLETED",
            appointmentAt: { $gte: fromDate, $lte: toDate },
          },
        },
        {
          $group: {
            _id: "$partnerId",
            count: { $sum: 1 },
          },
        },
      ]).session(dbSession);

      const cancelledGrouped = await FavoritePartner.aggregate([
        {
          $match: {
            organizationId: orgId,
            appointmentStatus: { $in: ["CANCELLED", "NOSHOW"] },
            appointmentAt: { $gte: fromDate, $lte: toDate },
          },
        },
        {
          $group: {
            _id: "$partnerId",
            count: { $sum: 1 },
          },
        },
      ]).session(dbSession);

      const completedMap = new Map<string, number>();
      for (const row of completedGrouped) {
        completedMap.set(String(row._id), Number(row.count ?? 0));
      }

      const cancelledMap = new Map<string, number>();
      for (const row of cancelledGrouped) {
        cancelledMap.set(String(row._id), Number(row.count ?? 0));
      }

      // 기존 periodKey의 PAID 아닌 라인 제거 후 재생성
      await Settlement.deleteMany({
        organizationId: orgId,
        periodKey,
        status: { $ne: "PAID" },
      }).session(dbSession);

      // 집계 대상 counterpartyId를 USE + ISSUE 합집합으로
      const allPartnerIds = new Set<string>();
      for (const row of useGrouped) {
        if (row._id) allPartnerIds.add(String(row._id));
      }
      for (const row of issueGrouped) {
        if (row._id) allPartnerIds.add(String(row._id));
      }

      // 파트너 정보 일괄 조회 (N+1 방지)
      const counterpartyOids = Array.from(allPartnerIds).map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      const counterpartyDocs = await User.find(
        { organizationId: orgId, _id: { $in: counterpartyOids } },
        { _id: 1, username: 1, name: 1, role: 1, status: 1 }
      ).session(dbSession).lean() as any[];

      const counterpartyMap = new Map<string, any>();
      for (const doc of counterpartyDocs) {
        counterpartyMap.set(String(doc._id), doc);
      }

      const useMap = new Map<string, {
        useCount: number;
        usedPoints: number;
        lastUsedAt: Date | null;
      }>();
      for (const row of useGrouped) {
        useMap.set(String(row._id), {
          useCount: Number(row.useCount ?? 0),
          usedPoints: Number(row.usedPoints ?? 0),
          lastUsedAt: row.lastUsedAt ?? null,
        });
      }

      let totalCounterparties = 0;
      let totalUseCount = 0;
      let totalUsedPoints = 0;

      const settlementDocs: any[] = [];

      for (const pidStr of allPartnerIds) {
        const counterpartyId = new mongoose.Types.ObjectId(pidStr);
        const counterparty = counterpartyMap.get(pidStr) ?? null;

        // PARTNER만 정산 대상
        if (counterparty?.role && counterparty.role !== "PARTNER") continue;

        const useData = useMap.get(pidStr) ?? { useCount: 0, usedPoints: 0, lastUsedAt: null };
        const issueData = issueMap.get(pidStr) ?? { issuedPoints: 0, issueCount: 0, visitorCount: 0 };

        const completedCount = completedMap.get(pidStr) ?? 0;
        const cancelledCount = cancelledMap.get(pidStr) ?? 0;

        const netPayable = useData.usedPoints;

        settlementDocs.push({
          organizationId: orgId,
          periodKey,
          from,
          to,
          status: "OPEN",
          closedAt: new Date(),
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
          useCount: useData.useCount,
          usedPoints: useData.usedPoints,
          issuedPoints: issueData.issuedPoints,
          issueCount: issueData.issueCount,
          visitorCount: issueData.visitorCount,
          completedCount,
          cancelledCount,
          feeRate: 0,
          feeAmount: 0,
          netPayable,
          lastUsedAt: useData.lastUsedAt,
          paidAt: null,
          payoutRef: "",
          note: "",
        });

        totalCounterparties += 1;
        totalUseCount += useData.useCount;
        totalUsedPoints += useData.usedPoints;
      }

      if (settlementDocs.length > 0) {
        await Settlement.insertMany(settlementDocs, { session: dbSession });
      }

      return {
        ok: true as const,
        periodKey,
        totalCounterparties,
        totalUseCount,
        totalUsedPoints,
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: String(e?.message ?? "정산 마감 실패") },
      { status: 500 }
    );
  } finally {
    dbSession.endSession();
  }
}
