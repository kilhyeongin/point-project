// src/app/api/admin/settlements/lines/route.ts
// =======================================================
// ADMIN: 마감된 정산 라인 조회
// -------------------------------------------------------
// - periodKey 필수
// - 새 필드 포함: issuedPoints, issueCount, visitorCount, completedCount, cancelledCount
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";
import { User } from "@/models/User";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, message: "관리자만 접근 가능합니다." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const periodKey = String(searchParams.get("periodKey") ?? "").trim();

  if (!periodKey) {
    return NextResponse.json(
      { ok: false, message: "periodKey가 필요합니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const orgId = session.orgId ?? "default";

  const docs = await Settlement.find({ organizationId: orgId, periodKey })
    .sort({ createdAt: -1 })
    .lean() as any[];

  const counterpartyIds = Array.from(
    new Set(
      docs
        .map((d: any) => (d.counterpartyId ? String(d.counterpartyId) : ""))
        .filter(Boolean)
    )
  ).map((id) => new mongoose.Types.ObjectId(id));

  const counterparties =
    counterpartyIds.length > 0
      ? await User.find(
          { organizationId: orgId, _id: { $in: counterpartyIds } },
          { username: 1, name: 1, role: 1, status: 1 }
        ).lean()
      : [];

  const counterpartyMap = new Map<string, any>();
  for (const u of counterparties as any[]) {
    counterpartyMap.set(String(u._id), u);
  }

  return NextResponse.json({
    ok: true,
    items: docs.map((doc: any) => {
      const cp = doc.counterpartyId
        ? counterpartyMap.get(String(doc.counterpartyId))
        : null;

      return {
        id: String(doc._id),
        periodKey: doc.periodKey,
        status: doc.status,
        useCount: Number(doc.useCount ?? 0),
        usedPoints: Number(doc.usedPoints ?? 0),
        issuedPoints: Number(doc.issuedPoints ?? 0),
        issueCount: Number(doc.issueCount ?? 0),
        visitorCount: Number(doc.visitorCount ?? 0),
        completedCount: Number(doc.completedCount ?? 0),
        cancelledCount: Number(doc.cancelledCount ?? 0),
        netPayable: Number(doc.netPayable ?? doc.usedPoints ?? 0),
        paidAt: doc.paidAt ?? null,
        payoutRef: doc.payoutRef ?? "",
        note: doc.note ?? "",
        counterparty: cp
          ? {
              id: String(cp._id),
              username: cp.username ?? "",
              name: cp.name ?? "",
              role: cp.role ?? "",
              status: cp.status ?? "",
            }
          : null,
      };
    }),
  });
}
