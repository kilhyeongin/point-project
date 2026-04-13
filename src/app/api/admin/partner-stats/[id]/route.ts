import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";
import { Ledger } from "@/models/Ledger";

const PAGE_SIZE = 20;

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
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));

  const orgId = session.orgId ?? "default";

  try {
    const partnerId = new mongoose.Types.ObjectId(id);
    const partner = await User.findOne({ _id: partnerId, organizationId: orgId })
      .select("_id username name").lean() as any;
    if (!partner) {
      return NextResponse.json({ ok: false, message: "제휴사 없음" }, { status: 404 });
    }

    const likedCount = await FavoritePartner.countDocuments({ organizationId: orgId, partnerId, status: "LIKED" });
    const appliedCount = await FavoritePartner.countDocuments({ organizationId: orgId, partnerId, status: "APPLIED" });

    const dateFilter = startDate && endDate ? { $gte: startDate, $lte: endDate } : undefined;

    // ISSUE: 제휴사 차감행만 (accountId=파트너) → 중복 방지
    // USE: 고객이 이 제휴사에서 사용한 행 (counterpartyId=파트너)
    const issueMatch: any = { organizationId: orgId, accountId: partnerId, type: "ISSUE" };
    const useMatch: any = { organizationId: orgId, counterpartyId: partnerId, type: "USE" };
    if (dateFilter) {
      issueMatch.createdAt = dateFilter;
      useMatch.createdAt = dateFilter;
    }

    const baseMatch: any = {
      organizationId: orgId,
      $or: [
        { accountId: partnerId, type: "ISSUE" },
        { counterpartyId: partnerId, type: "USE" },
      ],
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };

    // 요약 집계
    const summaryAgg = await Ledger.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          total: { $sum: { $abs: "$amount" } },
        },
      },
    ]);

    const issueRow = summaryAgg.find((r) => r._id === "ISSUE");
    const useRow = summaryAgg.find((r) => r._id === "USE");

    const uniqueCustomerIds = await Ledger.distinct("userId", {
      organizationId: orgId,
      accountId: partnerId,
      type: "ISSUE",
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    });

    const summary = {
      issueCount: issueRow?.count ?? 0,
      issueTotal: issueRow?.total ?? 0,
      useCount: useRow?.count ?? 0,
      useTotal: useRow?.total ?? 0,
      uniqueCustomers: uniqueCustomerIds.filter(Boolean).length,
    };

    // 페이지네이션 거래 내역
    const total = await Ledger.countDocuments(baseMatch);
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const ledgerDocs = await Ledger.find(baseMatch)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean() as any[];

    // 고객 정보 일괄 조회
    const userIds = [...new Set(ledgerDocs.map((d) => String(d.userId)).filter(Boolean))]
      .map((uid) => new mongoose.Types.ObjectId(uid));

    const users = userIds.length > 0
      ? await User.find({ _id: { $in: userIds } }, { username: 1, name: 1 }).lean() as any[]
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const transactions = ledgerDocs.map((doc) => {
      const user = doc.userId ? userMap.get(String(doc.userId)) : null;
      return {
        id: String(doc._id),
        type: doc.type,
        amount: Math.abs(Number(doc.amount ?? 0)),
        memo: doc.memo ?? "",
        createdAt: doc.createdAt,
        customer: user ? { name: user.name ?? "", username: user.username ?? "" } : null,
      };
    });

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
      transactions,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_STATS_DETAIL_ERROR]", error);
    return NextResponse.json({ ok: false, message: "조회 실패" }, { status: 500 });
  }
}
