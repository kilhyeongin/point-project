// src/app/api/admin/settlements/close/route.ts
// =======================================================
// ADMIN 월정산 마감(LOCK)
// -------------------------------------------------------
// 프론트 수수료율 입력 방식:
// - 10   => 10%  => 0.10
// - 7.5  => 7.5% => 0.075
//
// 방어 로직:
// - 0~1 값이 들어오면 기존 decimal 방식으로도 허용
// - 1 초과 ~ 100 이하는 % 값으로 보고 100으로 나눔
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
import { User } from "@/models/User";
import { Settlement } from "@/models/Settlement";

function parseFeeRate(raw: unknown) {
  const n = Number(raw);

  if (!Number.isFinite(n) || n < 0) {
    return { ok: false as const, message: "수수료율은 0 이상 숫자여야 합니다." };
  }

  // 기존 decimal 입력 허용: 0 ~ 1
  if (n <= 1) {
    return { ok: true as const, feeRate: n, feePercent: n * 100 };
  }

  // 운영 UI percent 입력: 1 초과 ~ 100
  if (n <= 100) {
    return { ok: true as const, feeRate: n / 100, feePercent: n };
  }

  return { ok: false as const, message: "수수료율은 최대 100%까지 입력할 수 있습니다." };
}

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
  const feeRate = 0;

  await connectDB();

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      // 이미 PAID 라인이 하나라도 있으면 재마감 금지
      const paidExists = await Settlement.exists({
        periodKey,
        status: "PAID",
      }).session(dbSession);

      if (paidExists) {
        throw new Error("이미 지급완료(PAID)된 정산 기간은 다시 마감할 수 없습니다.");
      }

      // 기간 내 제휴사 사용 실적 집계
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

      // 기존 periodKey의 PAID 아닌 라인 제거 후 재생성
      await Settlement.deleteMany({
        periodKey,
        status: { $ne: "PAID" },
      }).session(dbSession);

      let totalCounterparties = 0;
      let totalUseCount = 0;
      let totalUsedPoints = 0;

      for (const row of grouped) {
        const counterpartyId = row?._id ? new mongoose.Types.ObjectId(String(row._id)) : null;
        if (!counterpartyId) continue;

        const useCount = Number(row?.useCount ?? 0);
        const usedPoints = Number(row?.usedPoints ?? 0);
        const lastUsedAt = row?.lastUsedAt ?? null;

        const counterparty = await User.findById(counterpartyId, {
          _id: 1,
          username: 1,
          name: 1,
          role: 1,
          status: 1,
        }).session(dbSession);

        const feeAmount = 0;
        const netPayable = usedPoints;

        await Settlement.create(
          [
            {
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

              useCount,
              usedPoints,
              feeRate,
              feeAmount,
              netPayable,
              lastUsedAt,

              paidAt: null,
              payoutRef: "",
              note: "",
            },
          ],
          { session: dbSession }
        );

        totalCounterparties += 1;
        totalUseCount += useCount;
        totalUsedPoints += usedPoints;
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