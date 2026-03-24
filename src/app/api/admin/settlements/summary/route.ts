// src/app/api/admin/settlements/summary/route.ts
// =======================================================
// ADMIN: 정산 요약 조회
// -------------------------------------------------------
// - status별 건수
// - usedPoints / netPayable 합계
// - 수수료 없음
// =======================================================

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  await connectDB();

  const rows = await Settlement.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalUseCount: { $sum: "$useCount" },
        totalUsedPoints: { $sum: "$usedPoints" },
        totalNetPayable: { $sum: "$netPayable" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  const summary = {
    OPEN: {
      count: 0,
      totalUseCount: 0,
      totalUsedPoints: 0,
      totalNetPayable: 0,
    },
    PAID: {
      count: 0,
      totalUseCount: 0,
      totalUsedPoints: 0,
      totalNetPayable: 0,
    },
    CLOSED: {
      count: 0,
      totalUseCount: 0,
      totalUsedPoints: 0,
      totalNetPayable: 0,
    },
  };

  for (const row of rows) {
    const key = String(row._id) as "OPEN" | "PAID" | "CLOSED";
    if (!summary[key]) continue;

    summary[key] = {
      count: Number(row.count ?? 0),
      totalUseCount: Number(row.totalUseCount ?? 0),
      totalUsedPoints: Number(row.totalUsedPoints ?? 0),
      totalNetPayable: Number(row.totalNetPayable ?? 0),
    };
  }

  return NextResponse.json({
    ok: true,
    items: rows,
    summary,
  });
}