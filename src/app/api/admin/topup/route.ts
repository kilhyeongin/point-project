// src/app/api/admin/topup/route.ts
// =======================================================
// ADMIN: 제휴사 수동 충전
// -------------------------------------------------------
// ✔ Wallet 적립
// ✔ Ledger 이력 기록
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
import { User } from "@/models/User";
import { creditWallet } from "@/services/wallet";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { AuditLog } from "@/models/AuditLog";

export async function POST(req: Request & { ip?: string }) {
  const ip = getClientIp(req);
  if (await isRateLimited(`admin-topup:${ip}`, 20, 60 * 1000)) {
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
      { ok: false, message: "관리자 권한이 없습니다." },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const targetUserId = String(body?.targetUserId ?? "").trim();
  const amountNum = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim();

  if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
    return NextResponse.json(
      { ok: false, message: "유효한 targetUserId가 필요합니다." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(amountNum) || !Number.isInteger(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { ok: false, message: "amount는 1 이상의 정수여야 합니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const adminId = new mongoose.Types.ObjectId(session.uid);
  const targetOid = new mongoose.Types.ObjectId(targetUserId);

  const orgId = session.orgId ?? "4nwn";

  const target = await User.findOne({ _id: targetOid, organizationId: orgId }, {
    role: 1,
    username: 1,
    name: 1,
    status: 1,
  });

  if (!target) {
    return NextResponse.json(
      { ok: false, message: "대상 사용자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (target.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, message: "대상 사용자가 활성 상태가 아닙니다." },
      { status: 400 }
    );
  }

  if (String(target.role) !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "충전 대상은 제휴사만 가능합니다." },
      { status: 400 }
    );
  }

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const amount = Math.abs(amountNum);

      await creditWallet(targetOid, amount, dbSession);

      const ledger = await Ledger.create(
        [
          {
            organizationId: orgId,
            accountId: targetOid,
            actorId: adminId,
            type: "TOPUP",
            amount,
            refType: null,
            refId: null,
            note: note ? `관리자 수동 충전 / ${note}` : "관리자 수동 충전",
          },
        ],
        { session: dbSession }
      );

      return {
        ok: true as const,
        ledgerId: String(ledger[0]._id),
        amount,
        target: {
          id: String(target._id),
          username: target.username,
          name: target.name,
          role: target.role,
        },
      };
    });

    // Audit log (실패해도 이미 커밋된 트랜잭션에 영향 없음 — Ledger에 actorId 기록됨)
    AuditLog.create({
      adminId: adminId,
      adminUsername: session.username,
      action: "TOPUP",
      targetId: targetOid,
      targetUsername: target.username,
      detail: { amount: amountNum, note },
      ip,
    }).catch((auditErr) => {
      console.error("[AUDIT_LOG_FAIL] TOPUP", auditErr);
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