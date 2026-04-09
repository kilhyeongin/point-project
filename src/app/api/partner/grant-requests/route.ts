// src/app/api/partner/grant-requests/route.ts
// =======================================================
// PARTNER 전용: QR 스캔으로 고객에게 포인트 적립 지급
// -------------------------------------------------------
// POST : 제휴사 포인트 → 고객 포인트 즉시 이전 (트랜잭션)
//   - 제휴사 지갑 차감 + 고객 지갑 적립
//   - 신청(APPLIED) 고객에게만 가능
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Ledger } from "@/models/Ledger";
import { FavoritePartner } from "@/models/FavoritePartner";
import { debitWallet, creditWallet } from "@/services/wallet";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

function parseQrPayload(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.startsWith("POINTQR:")) return s.replace("POINTQR:", "").trim();
  return s;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (await isRateLimited(`grant-req:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (await isRateLimited(`grant-req:${session.uid}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }
  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 요청할 수 있습니다." }, { status: 403 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const qrPayloadRaw = String(body?.qrPayload ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, message: "amount는 1 이상 숫자여야 합니다." }, { status: 400 });
  }
  if (amount > 100_000_000) {
    return NextResponse.json({ ok: false, message: "요청 금액이 너무 큽니다." }, { status: 400 });
  }
  if (!qrPayloadRaw) {
    return NextResponse.json({ ok: false, message: "qrPayload가 필요합니다." }, { status: 400 });
  }

  const secret = process.env.QR_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "QR_SECRET이 설정되어 있지 않습니다." }, { status: 500 });
  }

  const token = parseQrPayload(qrPayloadRaw);
  let targetUser: any = null;

  try {
    const decoded: any = jwt.verify(token, secret, {
      issuer: "point-platform",
      audience: "partner-scan",
    });
    if (decoded?.typ !== "customer_qr") {
      return NextResponse.json({ ok: false, message: "QR 타입이 올바르지 않습니다." }, { status: 400 });
    }
    const customerId = String(decoded?.sub ?? "");
    if (!customerId) {
      return NextResponse.json({ ok: false, message: "QR에 고객 정보가 없습니다." }, { status: 400 });
    }
    await connectDB();
    targetUser = await User.findOne(
      { _id: new mongoose.Types.ObjectId(customerId), organizationId: session.orgId ?? "default" },
      { _id: 1, role: 1, status: 1, username: 1, name: 1 }
    );
  } catch (e: any) {
    const m = String(e?.message ?? "");
    const friendly = m.includes("jwt expired")
      ? "QR이 만료되었습니다. 고객에게 QR을 새로고침 요청하세요."
      : "QR 검증 실패";
    return NextResponse.json({ ok: false, message: friendly }, { status: 400 });
  }

  if (!targetUser) {
    return NextResponse.json({ ok: false, message: "대상 고객을 찾을 수 없습니다." }, { status: 404 });
  }
  if (targetUser.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, message: "대상 사용자가 활성 상태가 아닙니다." }, { status: 400 });
  }
  if (targetUser.role !== "CUSTOMER") {
    return NextResponse.json({ ok: false, message: "적립 대상은 고객(CUSTOMER)만 가능합니다." }, { status: 400 });
  }

  const customerId = new mongoose.Types.ObjectId(String(targetUser._id));
  const partnerId = new mongoose.Types.ObjectId(session.uid);

  const relation = await FavoritePartner.findOne({
    organizationId: session.orgId ?? "default",
    customerId,
    partnerId,
    status: "APPLIED",
  }).lean();

  if (!relation) {
    return NextResponse.json(
      { ok: false, message: "신청한 고객에게만 포인트를 지급할 수 있습니다." },
      { status: 403 }
    );
  }

  const dbSession = await mongoose.startSession();
  try {
    const result = await dbSession.withTransaction(async () => {
      // 제휴사 포인트 차감
      const partnerDebit = await debitWallet(partnerId, Math.abs(amount), dbSession);

      // 고객 포인트 적립
      const customerCredit = await creditWallet(customerId, Math.abs(amount), dbSession);

      // Ledger: 제휴사 차감행
      const ledgerDocs = await Ledger.create(
        [
          {
            organizationId: session.orgId ?? "default",
            accountId: partnerId,
            userId: customerId,
            actorId: partnerId,
            counterpartyId: customerId,
            type: "ISSUE",
            amount: -Math.abs(amount),
            note: note ? `포인트 지급 - ${note}` : "QR 적립 지급",
          },
          {
            organizationId: session.orgId ?? "default",
            accountId: customerId,
            userId: customerId,
            actorId: partnerId,
            counterpartyId: partnerId,
            type: "ISSUE",
            amount: Math.abs(amount),
            note: note ? `포인트 적립 - ${note}` : "QR 적립",
          },
        ],
        { session: dbSession, ordered: true }
      );

      return {
        partnerBalanceAfter: partnerDebit.balanceAfter,
        customerBalanceAfter: customerCredit.balanceAfter,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        instant: true,
        to: { username: targetUser.username, name: targetUser.name },
        amount,
        partnerBalanceAfter: result.partnerBalanceAfter,
        customerBalanceAfter: result.customerBalanceAfter,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    const msg = String(e?.message ?? "서버 오류");
    const status = msg.startsWith("잔액 부족:") ? 400 : 500;
    return NextResponse.json({ ok: false, message: msg }, { status });
  } finally {
    dbSession.endSession();
  }
}
