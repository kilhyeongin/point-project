// src/app/api/admin/payout-stats/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { Ledger } from "@/models/Ledger";
import { User } from "@/models/User";

function parseDateStart(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999+09:00`);
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

    // 둘 중 하나만 입력된 경우에만 오류
    if ((startDateRaw && !startDate) || (endDateRaw && !endDate)) {
      return NextResponse.json(
        { ok: false, message: "유효하지 않은 날짜 형식입니다." },
        { status: 400 }
      );
    }

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      return NextResponse.json(
        { ok: false, message: "시작일은 종료일보다 늦을 수 없습니다." },
        { status: 400 }
      );
    }

    const orgId = session.orgId ?? "4nwn";

    const partners = await User.find(
      { organizationId: orgId, role: "PARTNER" },
      { _id: 1, username: 1, name: 1, status: 1 }
    ).lean();

    const results = await Promise.all(
      partners.map(async (partner: any) => {
        const ledgerFilter: any = {
          organizationId: orgId,
          type: "TOPUP",
          accountId: partner._id,
        };

        // 날짜 필터가 있을 때만 기간 조건 추가
        if (startDate && endDate) {
          ledgerFilter.createdAt = { $gte: startDate, $lte: endDate };
        }

        const rows = await Ledger.find(
          ledgerFilter,
          {
            amount: 1,
            createdAt: 1,
          }
        )
          .sort({ createdAt: -1 })
          .limit(5000)
          .lean();

        const issueCount = rows.length;
        const issueTotal = rows.reduce(
          (sum: number, row: any) => sum + Math.abs(Number(row.amount ?? 0)),
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