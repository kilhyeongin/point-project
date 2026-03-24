// src/app/api/admin/settlements/payout-cancel/route.ts
// =======================================================
// ADMIN: 정산 지급 취소
// -------------------------------------------------------
// POST body:
//  - periodKey (필수, YYYY-MM)
//  - counterpartyId (필수, ObjectId string)
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";

export async function POST(req: Request) {
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

  const counterpartyId = new mongoose.Types.ObjectId(counterpartyIdStr);
  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const line = await Settlement.findOne({
        periodKey,
        counterpartyId,
      }).session(dbSession);

      if (!line) {
        return {
          ok: false as const,
          message: "정산 라인이 없습니다.",
        };
      }

      if (line.status !== "PAID") {
        return {
          ok: false as const,
          message: "지급 완료된 정산만 취소할 수 있습니다.",
        };
      }

      line.status = "OPEN";
      line.paidAt = null;
      line.payoutRef = "";
      line.note = "";

      await line.save({ session: dbSession });

      return {
        ok: true as const,
        periodStatus: "CLOSED",
      };
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: 400 }
      );
    }

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