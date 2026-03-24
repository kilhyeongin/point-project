import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";
import { Ledger } from "@/models/Ledger";

export async function GET() {
  await connectDB();

  const session = await getSessionFromCookies();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "권한 없음" }, { status: 403 });
  }

  try {
    const partners = await User.find({
      role: "PARTNER",
      status: "ACTIVE",
    })
      .select("_id username name")
      .lean();

    const items = await Promise.all(
      partners.map(async (partner: any) => {
        const partnerId = new mongoose.Types.ObjectId(String(partner._id));

        const likedCount = await FavoritePartner.countDocuments({
          partnerId,
          status: "LIKED",
        });

        const appliedCount = await FavoritePartner.countDocuments({
          partnerId,
          status: "APPLIED",
        });

        const issueAgg = await Ledger.aggregate([
          {
            $match: {
              actorId: partnerId,
              type: "ISSUE",
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              total: { $sum: "$amount" },
            },
          },
        ]);

        const useAgg = await Ledger.aggregate([
          {
            $match: {
              actorId: partnerId,
              type: "USE",
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              total: { $sum: { $abs: "$amount" } },
            },
          },
        ]);

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
        };
      })
    );

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[ADMIN_PARTNER_STATS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, message: "제휴사 운영 현황 조회 실패" },
      { status: 500 }
    );
  }
}