import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { GeneralSettlement } from "@/models/GeneralSettlement";

// GET: 관리자 - 일반 정산 전체 목록 조회
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ ok: false }, { status: 403 });

  await connectDB();

  const orgId = session.orgId ?? "4nwn";

  const items = await GeneralSettlement.find({ organizationId: orgId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean() as any[];

  return NextResponse.json({
    ok: true,
    items: items.map((item) => ({
      id: String(item._id),
      partnerId: String(item.partnerId),
      partnerName: item.partnerName,
      year: item.year,
      month: item.month,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      columns: item.columns,
      rows: item.rows,
      subtotal: item.subtotal,
      tax: item.tax,
      total: item.total,
      status: item.status,
      submittedAt: item.submittedAt ?? null,
      confirmedAt: item.confirmedAt ?? null,
      createdAt: item.createdAt,
    })),
  });
}
