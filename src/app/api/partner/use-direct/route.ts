// src/app/api/partner/use-direct/route.ts
// =======================================================
// PARTNER: 고객 포인트 즉시 차감 처리
// -------------------------------------------------------
// ✔ PARTNER만 가능
// ✔ 신청(APPLIED) 고객만 가능
// ✔ 고객 Wallet에서 원자적 차감
// ✔ Ledger는 이력 기록용
// ✔ 정산용 counterpartyId 저장
// ✔ amount는 정수만 허용
// ✔ 1회 최대 사용 포인트 제한
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Ledger } from "@/models/Ledger";
import { FavoritePartner } from "@/models/FavoritePartner";
import { debitWallet, creditWallet } from "@/services/wallet";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

const MAX_USE_AMOUNT = 1_000_000;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (await isRateLimited(`use-direct:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (await isRateLimited(`use-direct:${session.uid}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "제휴사만 사용할 수 있습니다." },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const customerId = String(body?.userId ?? "").trim();
  const rawAmount = body?.amount;
  const amountNum = Number(rawAmount);
  const note = String(body?.note ?? "").trim();

  if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
    return NextResponse.json(
      { ok: false, message: "유효한 userId가 필요합니다." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(amountNum)) {
    return NextResponse.json(
      { ok: false, message: "amount는 숫자여야 합니다." },
      { status: 400 }
    );
  }

  if (!Number.isInteger(amountNum)) {
    return NextResponse.json(
      { ok: false, message: "포인트는 소수점 없이 정수만 입력할 수 있습니다." },
      { status: 400 }
    );
  }

  if (amountNum < 1) {
    return NextResponse.json(
      { ok: false, message: "amount는 1 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (amountNum > MAX_USE_AMOUNT) {
    return NextResponse.json(
      {
        ok: false,
        message: `1회 최대 차감 가능 포인트는 ${MAX_USE_AMOUNT.toLocaleString()}P 입니다.`,
      },
      { status: 400 }
    );
  }

  await connectDB();

  const customerOid = new mongoose.Types.ObjectId(customerId);
  const partnerOid = new mongoose.Types.ObjectId(session.uid);

  const relation = await FavoritePartner.findOne({
    organizationId: session.orgId ?? "4nwn",
    customerId: customerOid,
    partnerId: partnerOid,
    status: "APPLIED",
  }).lean();

  if (!relation) {
    return NextResponse.json(
      { ok: false, message: "신청 고객에게만 즉시 차감할 수 있습니다." },
      { status: 403 }
    );
  }

  const customer = await User.findOne({ _id: customerOid, organizationId: session.orgId ?? "4nwn" }, {
    _id: 1,
    username: 1,
    name: 1,
    role: 1,
    status: 1,
  });

  if (!customer) {
    return NextResponse.json(
      { ok: false, message: "고객을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (customer.role !== "CUSTOMER") {
    return NextResponse.json(
      { ok: false, message: "CUSTOMER만 차감 처리할 수 있습니다." },
      { status: 400 }
    );
  }

  if (customer.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, message: "활성 상태 고객만 처리할 수 있습니다." },
      { status: 400 }
    );
  }

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const amount = amountNum;

      // 고객 포인트 차감
      const debit = await debitWallet(customerOid, amount, dbSession);
      // 제휴사 포인트 적립
      await creditWallet(partnerOid, amount, dbSession);

      await Ledger.create(
        [
          {
            organizationId: session.orgId ?? "4nwn",
            accountId: customerOid,
            userId: customerOid,
            actorId: partnerOid,
            counterpartyId: partnerOid,
            type: "USE",
            amount: -amount,
            refType: "USE_DIRECT",
            refId: null,
            note: note ? `포인트 사용 / ${note}` : "포인트 사용",
          },
          {
            organizationId: session.orgId ?? "4nwn",
            accountId: partnerOid,
            userId: partnerOid,
            actorId: partnerOid,
            counterpartyId: customerOid,
            type: "USE",
            amount: +amount,
            refType: "USE_DIRECT",
            refId: null,
            note: note ? `포인트 수취 / ${note}` : "포인트 수취",
          },
        ],
        { session: dbSession, ordered: true }
      );

      return {
        ok: true as const,
        balanceBefore: debit.balanceBefore,
        balanceAfter: debit.balanceAfter,
        customer: {
          id: String(customer._id),
          username: customer.username,
          name: customer.name,
        },
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    const msg = String(e?.message ?? "서버 오류");
    const status = msg.startsWith("잔액 부족:") ? 400 : 500;
    return NextResponse.json({ ok: false, message: msg }, { status });
  } finally {
    dbSession.endSession();
  }
}