// src/app/api/admin/topup-requests/route.ts
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { TopupRequest } from "@/models/TopupRequest";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, message: "관리자만 접근 가능합니다." },
      { status: 403 }
    );
  }

  await connectDB();

  const orgId = session.orgId ?? "4nwn";

  const docs = await TopupRequest.find({ organizationId: orgId })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("accountId", "username name role")
    .populate("requestedById", "username name role")
    .populate("approvedById", "username name role")
    .lean();

  const items = docs.map((d: any) => ({
    id: String(d._id),
    amount: d.amount,
    status: d.status,
    note: d.note ?? "",
    createdAt: d.createdAt,
    decidedAt: d.decidedAt ?? null,
    ledgerId: d.ledgerId ? String(d.ledgerId) : null,
    account: d.accountId
      ? {
          id: String(d.accountId._id),
          username: d.accountId.username,
          name: d.accountId.name,
          role: d.accountId.role,
        }
      : null,
    requestedBy: d.requestedById
      ? {
          id: String(d.requestedById._id),
          username: d.requestedById.username,
          name: d.requestedById.name,
          role: d.requestedById.role,
        }
      : null,
    approvedBy: d.approvedById
      ? {
          id: String(d.approvedById._id),
          username: d.approvedById.username,
          name: d.approvedById.name,
          role: d.approvedById.role,
        }
      : null,
  }));

  return NextResponse.json({ ok: true, items });
}