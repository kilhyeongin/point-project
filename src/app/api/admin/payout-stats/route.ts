// src/app/api/admin/payout-stats/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { Ledger } from "@/models/Ledger";
import { User } from "@/models/User";

function parseDateStart(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  try {
    await connectDB();

    const session = await getSessionFromCookies();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { ok: false, message: "권한 없음" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const startDateRaw = searchParams.get("startDate");
    const endDateRaw = searchParams.get("endDate");

    const startDate = parseDateStart(startDateRaw);
    const endDate = parseDateEnd(endDateRaw);

    if (!startDate || !endDate) {
      return NextResponse.json(
        { ok: false, message: "유효한 시작일/종료일이 필요합니다." },
        { status: 400 }
      );
    }

    if (startDate.getTime() > endDate.getTime()) {
      return NextResponse.json(
        { ok: false, message: "시작일은 종료일보다 늦을 수 없습니다." },
        { status: 400 }
      );
    }

    const orgId = session.orgId ?? "default";

    const partners = await User.find(
      { organizationId: orgId, role: "PARTNER" },
      { _id: 1, username: 1, name: 1, status: 1 }
    ).lean();

    const results = await Promise.all(
      partners.map(async (partner: any) => {
        const rows = await Ledger.find(
          {
            organizationId: orgId,
            type: "ISSUE",
            actorId: partner._id,
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          },
          {
            amount: 1,
            createdAt: 1,
          }
        )
          .sort({ createdAt: -1 })
          .lean();

        const issueCount = rows.length;
        const issueTotal = rows.reduce(
          (sum: number, row: any) => sum + Number(row.amount ?? 0),
          0
        );
        const avgIssue =
          issueCount > 0 ? Math.round(issueTotal / issueCount) : 0;
        const lastIssuedAt = rows[0]?.createdAt ?? null;

        return {
          partnerId: String(partner._id),
          username: String(partner.username ?? ""),
          name: String(partner.name ?? ""),
          status: String(partner.status ?? ""),
          issueCount,
          issueTotal,
          avgIssue,
          lastIssuedAt,
        };
      })
    );

    results.sort((a, b) => {
      if (b.issueTotal !== a.issueTotal) return b.issueTotal - a.issueTotal;
      if (b.issueCount !== a.issueCount) return b.issueCount - a.issueCount;
      return a.name.localeCompare(b.name, "ko");
    });

    return NextResponse.json({
      ok: true,
      range: {
        startDate: startDateRaw,
        endDate: endDateRaw,
      },
      items: results,
    });
  } catch (error) {
    console.error("[ADMIN_PAYOUT_STATS_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, message: "지급 현황 조회 실패" },
      { status: 500 }
    );
  }
}