import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";
import { Ledger } from "@/models/Ledger";

function parseDateStart(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000`);
  return isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999`);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "권한 없음" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const startDate = parseDateStart(searchParams.get("startDate"));
  const endDate = parseDateEnd(searchParams.get("endDate"));

  try {
    const partnerId = new mongoose.Types.ObjectId(id);
    const partner = await User.findById(partnerId).select("_id username name").lean() as any;
    if (!partner) {
      return NextResponse.json({ ok: false, message: "제휴사 없음" }, { status: 404 });
    }

    const likedCount = await FavoritePartner.countDocuments({ partnerId, status: "LIKED" });
    const appliedCount = await FavoritePartner.countDocuments({ partnerId, status: "APPLIED" });

    const dateFilter = startDate && endDate ? { $gte: startDate, $lte: endDate } : undefined;
    const issueMatch: any = { actorId: partnerId, type: "ISSUE" };
    const useMatch: any = { actorId: partnerId, type: "USE" };
    if (dateFilter) {
      issueMatch.createdAt = dateFilter;
      useMatch.createdAt = dateFilter;
    }

    // 월별 지급 집계
    const issueMonthly = await Ledger.aggregate([
      { $match: issueMatch },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // 월별 차감 집계
    const useMonthly = await Ledger.aggregate([
      { $match: useMatch },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
          total: { $sum: { $abs: "$amount" } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // 월별 데이터 병합
    const monthMap: Record<string, { issueCount: number; issueTotal: number; useCount: number; useTotal: number }> = {};
    for (const row of issueMonthly) {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { issueCount: 0, issueTotal: 0, useCount: 0, useTotal: 0 };
      monthMap[key].issueCount = row.count;
      monthMap[key].issueTotal = row.total;
    }
    for (const row of useMonthly) {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { issueCount: 0, issueTotal: 0, useCount: 0, useTotal: 0 };
      monthMap[key].useCount = row.count;
      monthMap[key].useTotal = row.total;
    }

    const monthly = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    // 이용 고객 수 (기간 내 거래 있는 유니크 고객)
    const uniqueCustomerIds = await Ledger.distinct("userId", {
      actorId: partnerId,
      type: { $in: ["ISSUE", "USE"] },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    });

    const summary = {
      issueCount: monthly.reduce((s, m) => s + m.issueCount, 0),
      issueTotal: monthly.reduce((s, m) => s + m.issueTotal, 0),
      useCount: monthly.reduce((s, m) => s + m.useCount, 0),
      useTotal: monthly.reduce((s, m) => s + m.useTotal, 0),
      uniqueCustomers: uniqueCustomerIds.filter(Boolean).length,
    };

    return NextResponse.json({
      ok: true,
      partner: {
        id: String(partner._id),
        username: partner.username,
        name: partner.name,
        likedCount,
        appliedCount,
      },
      summary,
      monthly,
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_STATS_DETAIL_ERROR]", error);
    return NextResponse.json({ ok: false, message: "조회 실패" }, { status: 500 });
  }
}
