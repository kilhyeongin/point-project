// src/app/api/admin/use-requests/route.ts
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UseRequest } from "@/models/UseRequest";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "관리자 권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = String(searchParams.get("status") ?? "PENDING").toUpperCase();

  await connectDB();

  const orgId = session.orgId ?? "default";
  const filter: any = { organizationId: orgId };
  if (["PENDING", "APPROVED", "REJECTED"].includes(statusParam)) {
    filter.status = statusParam;
  }

  const docs = await UseRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("userId", "username name")
    .populate("partnerId", "username name")
    .lean();

  const items = docs.map((d: any) => ({
    id: d._id.toString(),
    status: d.status,
    amount: d.amount,
    note: d.note,
    createdAt: d.createdAt,
    to: d.userId ? { username: d.userId.username, name: d.userId.name } : null,
    requester: d.partnerId ? { username: d.partnerId.username, name: d.partnerId.name } : null,
  }));

  return NextResponse.json({ ok: true, items });
}
