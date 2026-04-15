import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PointSettlementPayment } from "@/models/PointSettlementPayment";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ ok: false }, { status: 403 });

  await connectDB();
  const orgId = session.orgId ?? "4nwn";

  const items = await PointSettlementPayment.find({ organizationId: orgId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean() as any[];

  return NextResponse.json({
    ok: true,
    items: items.map((i) => ({
      id: String(i._id),
      partnerId: String(i.partnerId),
      partnerName: i.partnerName,
      year: i.year,
      month: i.month,
      amount: i.amount,
      note: i.note,
      status: i.status,
      confirmedAt: i.confirmedAt ?? null,
      cancelledAt: i.cancelledAt ?? null,
      createdAt: i.createdAt,
    })),
  });
}
