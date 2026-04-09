// src/app/api/admin/settlements/payout/route.ts
// =======================================================
// ADMIN: 정산 지급 처리(업체별 라인 PAID)
// -------------------------------------------------------
// POST body:
//  - periodKey (필수, YYYY-MM)
//  - counterpartyId (필수, ObjectId string)
//  - payoutRef (선택)
//  - note (선택)
// -------------------------------------------------------
// 동작:
// 1) Settlement 라인 1건을 PAID 처리
// 2) 해당 periodKey의 모든 라인이 PAID면 periodStatus도 PAID로 반환
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { AuditLog } from "@/models/AuditLog";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (await isRateLimited(`admin-payout:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const periodKey = String(body?.periodKey ?? "").trim();
  const counterpartyIdStr = String(body?.counterpartyId ?? "").trim();
  const payoutRef = String(body?.payoutRef ?? "").trim();
  const note = String(body?.note ?? "").trim();

  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    return NextResponse.json(
      { ok: false, message: "periodKey는 YYYY-MM 형식이어야 합니다." },
      { status: 400 }
    );
  }

  if (!mongoose.Types.ObjectId.isValid(counterpartyIdStr)) {
    return NextResponse.json(
      { ok: false, message: "counterpartyId 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const orgId = session.orgId ?? "default";
  const counterpartyId = new mongoose.Types.ObjectId(counterpartyIdStr);
  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const line = await Settlement.findOne({
        organizationId: orgId,
        periodKey,
        counterpartyId,
      }).session(dbSession);

      if (!line) {
        return {
          ok: false as const,
          message: "정산 라인이 없습니다. 먼저 마감(LOCK)하세요.",
        };
      }

      if (line.status === "PAID") {
        const remaining = await Settlement.countDocuments({
          organizationId: orgId,
          periodKey,
          status: { $ne: "PAID" },
        }).session(dbSession);

        return {
          ok: true as const,
          message: "이미 지급 완료된 라인입니다.",
          periodStatus: remaining === 0 ? "PAID" : "CLOSED",
        };
      }

      line.status = "PAID";
      line.paidAt = new Date();
      line.payoutRef = payoutRef;
      line.note = note;

      await line.save({ session: dbSession });

      const remaining = await Settlement.countDocuments({
        organizationId: orgId,
        periodKey,
        status: { $ne: "PAID" },
      }).session(dbSession);

      return {
        ok: true as const,
        periodStatus: remaining === 0 ? "PAID" : "CLOSED",
      };
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: 400 }
      );
    }

    // Audit log
    await AuditLog.create({
      adminId: new mongoose.Types.ObjectId(session.uid),
      adminUsername: session.username,
      action: "PAYOUT",
      detail: { periodKey, counterpartyId: counterpartyIdStr, payoutRef, note },
      ip,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: String(e?.message ?? "서버 오류") },
      { status: 500 }
    );
  } finally {
    dbSession.endSession();
  }
}