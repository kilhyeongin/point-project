// src/app/api/admin/settlements/periods/route.ts
// =======================================================
// ADMIN: 정산 기간 목록 조회
// -------------------------------------------------------
// 반환:
// - periodKey
// - from
// - to
// - status (OPEN | CLOSED | PAID)
// - totalCounterparties
// - totalUseCount
// - totalUsedPoints
// =======================================================

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";

function computeStatus(lines: any[]): "OPEN" | "CLOSED" | "PAID" {
  if (!lines.length) return "OPEN";

  const allPaid = lines.every((l) => l.status === "PAID");
  if (allPaid) return "PAID";

  return "CLOSED";
}

export async function GET() {
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

  await connectDB();

  const orgId = session.orgId ?? "default";

  // 모든 정산 라인 조회
  const docs = await Settlement.find({ organizationId: orgId })
    .sort({ periodKey: -1 })
    .lean();

  // periodKey 기준으로 그룹화
  const map = new Map<string, any[]>();

  for (const d of docs) {
    const key = String(d.periodKey ?? "");

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key)!.push(d);
  }

  const items = Array.from(map.entries()).map(([periodKey, lines]) => {
    let totalUseCount = 0;
    let totalUsedPoints = 0;

    for (const l of lines) {
      totalUseCount += Number(l.useCount ?? 0);
      totalUsedPoints += Number(l.usedPoints ?? 0);
    }

    const from = lines[0]?.from ?? `${periodKey}-01`;
    const to = lines[0]?.to ?? `${periodKey}-31`;

    return {
      periodKey,
      from,
      to,
      status: computeStatus(lines),
      closedAt: lines[0]?.closedAt ?? null,
      totalCounterparties: lines.length,
      totalUseCount,
      totalUsedPoints,
    };
  });

  // 최신 월이 위로
  items.sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  return NextResponse.json({
    ok: true,
    items,
  });
}