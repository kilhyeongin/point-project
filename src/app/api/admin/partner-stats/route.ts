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

export async function GET(req: Request) {
  await connectDB();

  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "권한 없음" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = parseDateStart(searchParams.get("startDate"));
  const endDate = parseDateEnd(searchParams.get("endDate"));

  const orgId = session.orgId ?? "4nwn";

  try {
    const partners = await User.find({ organizationId: orgId, role: "PARTNER", status: "ACTIVE" })
      .select("_id username name")
      .lean();

    const items = await Promise.all(
      partners.map(async (partner: any) => {
        const partnerId = new mongoose.Types.ObjectId(String(partner._id));

        const likedCount = await FavoritePartner.countDocuments({ organizationId: orgId, partnerId, status: "LIKED" });
        const appliedCount = await FavoritePartner.countDocuments({ organizationId: orgId, partnerId, status: "APPLIED" });

        const dateFilter = startDate && endDate ? { $gte: startDate, $lte: endDate } : undefined;
        const issueMatch: any = { organizationId: orgId, accountId: partnerId, type: "ISSUE" };
        const useMatch: any = { organizationId: orgId, actorId: partnerId, type: "USE" };
        if (dateFilter) {
          issueMatch.createdAt = dateFilter;
          useMatch.createdAt = dateFilter;
        }

        const issueAgg = await Ledger.aggregate([
          { $match: issueMatch },
          { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $abs: "$amount" } } } },
        ]);

        const useAgg = await Ledger.aggregate([
          { $match: useMatch },
          { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $abs: "$amount" } } } },
        ]);

        const uniqueCustomerIds = await Ledger.distinct("userId", {
          organizationId: orgId,
          accountId: partnerId,
          type: "ISSUE",
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        });

        return {
          partnerId: String(partner._id),
          username: partner.username ?? "",
          name: partner.name ?? "",
          likedCount,
          appliedCount,
          issueCount: issueAgg[0]?.count ?? 0,
          issueTotal: issueAgg[0]?.total ?? 0,
          useCount: useAgg[0]?.count ?? 0,
          useTotal: useAgg[0]?.total ?? 0,
          uniqueCustomers: uniqueCustomerIds.filter(Boolean).length,
        };
      })
    );

    items.sort((a, b) => b.issueTotal - a.issueTotal);

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[ADMIN_PARTNER_STATS_GET_ERROR]", error);
    return NextResponse.json({ ok: false, message: "조회 실패" }, { status: 500 });
  }
}
