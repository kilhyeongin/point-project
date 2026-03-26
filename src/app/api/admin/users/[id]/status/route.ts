// src/app/api/admin/users/[id]/status/route.ts
// ADMIN: 계정 상태 변경 (ACTIVE / BLOCKED)

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  if (await isRateLimited(`admin-status:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다." }, { status: 429 });
  }

  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "관리자만 접근 가능합니다." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const newStatus = String(body?.status ?? "").toUpperCase();

  if (!["ACTIVE", "BLOCKED"].includes(newStatus)) {
    return NextResponse.json(
      { ok: false, message: "status는 ACTIVE 또는 BLOCKED 이어야 합니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const user = await User.findById(id, { role: 1, status: 1 }).lean();

  if (!user) {
    return NextResponse.json({ ok: false, message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  // Protect admin accounts from being blocked by themselves or other admins
  if ((user as any).role === "ADMIN" && newStatus === "BLOCKED") {
    return NextResponse.json(
      { ok: false, message: "관리자 계정은 차단할 수 없습니다." },
      { status: 403 }
    );
  }

  const prevStatus = (user as any).status;
  await User.updateOne({ _id: id }, { $set: { status: newStatus } });

  // Audit log
  await AuditLog.create({
    adminId: new mongoose.Types.ObjectId(session.uid),
    adminUsername: session.username,
    action: "STATUS_CHANGE",
    targetId: new mongoose.Types.ObjectId(id),
    detail: { from: prevStatus, to: newStatus },
    ip: getClientIp(req),
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
