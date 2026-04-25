// src/app/api/admin/adjust/route.ts
// =======================================================
// ADMIN: 포인트 수동 조정
// -------------------------------------------------------
// ✔ ADMIN만 가능
// ✔ Wallet +/- 조정
// ✔ 음수 조정 시 잔액 부족 방지
// ✔ Ledger.type = ADJUST
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Ledger } from "@/models/Ledger";
import { creditWallet, debitWallet } from "@/services/wallet";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { AuditLog } from "@/models/AuditLog";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`adjust:${ip}`, 30, 60 * 1000)) {
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

  const targetUserId = String(body?.targetUserId ?? "").trim();
  const amountNum = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim();

  if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
    return NextResponse.json(
      { ok: false, message: "유효한 targetUserId가 필요합니다." },
      { status: 400 }
    );
  }

  const MAX_ADJUST = 100_000_000; // 1회 최대 ±1억P
  if (!Number.isFinite(amountNum) || !Number.isInteger(amountNum) || amountNum === 0) {
    return NextResponse.json(
      { ok: false, message: "amount는 0이 아닌 정수여야 합니다." },
      { status: 400 }
    );
  }
  if (Math.abs(amountNum) > MAX_ADJUST) {
    return NextResponse.json(
      { ok: false, message: `1회 최대 조정 가능 금액은 ±${MAX_ADJUST.toLocaleString()}P 입니다.` },
      { status: 400 }
    );
  }
  if (!note) {
    return NextResponse.json(
      { ok: false, message: "수동 조정 사유(note)를 입력해주세요." },
      { status: 400 }
    );
  }

  await connectDB();

  const targetOid = new mongoose.Types.ObjectId(targetUserId);
  const adminOid = new mongoose.Types.ObjectId(session.uid);

  const orgId = session.orgId ?? "4nwn";

  const target = await User.findOne({ _id: targetOid, organizationId: orgId }, {
    _id: 1,
    username: 1,
    name: 1,
    role: 1,
    status: 1,
  });

  if (!target) {
    return NextResponse.json(
      { ok: false, message: "대상 사용자를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      if (amountNum > 0) {
        await creditWallet(targetOid, amountNum, dbSession);
      } else {
        await debitWallet(targetOid, Math.abs(amountNum), dbSession);
      }

      const ledger = await Ledger.create(
        [
          {
            organizationId: orgId,
            accountId: targetOid,
            userId: targetOid,
            actorId: adminOid,
            counterpartyId: adminOid,
            type: "ADJUST",
            amount: amountNum,
            refType: "ADJUST",
            refId: null,
            note: note ? `관리자 수동 조정 / ${note}` : "관리자 수동 조정",
          },
        ],
        { session: dbSession }
      );

      return {
        ok: true as const,
        ledgerId: String(ledger[0]._id),
        target: {
          id: String(target._id),
          username: target.username,
          name: target.name,
          role: target.role,
        },
        amount: amountNum,
      };
    });

    // Audit log (실패해도 이미 커밋된 트랜잭션에 영향 없음 — Ledger에 actorId 기록됨)
    AuditLog.create({
      adminId: adminOid,
      adminUsername: session.username,
      action: "ADJUST",
      targetId: targetOid,
      targetUsername: target.username,
      detail: { amount: amountNum, note },
      ip,
    }).catch((auditErr) => {
      console.error("[AUDIT_LOG_FAIL] ADJUST", auditErr);
    });

    return NextResponse.json(result);
  } catch (e: any) {
    const msg = String(e?.message ?? "서버 오류");
    if (msg.startsWith("잔액 부족:")) {
      return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}