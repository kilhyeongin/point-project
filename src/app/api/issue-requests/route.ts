// src/app/api/issue-requests/route.ts
// =======================================================
// 제휴사: 신청 고객에게만 포인트 즉시 지급 API
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { IssueRequest } from "@/models/IssueRequest";
import { Ledger } from "@/models/Ledger";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";
import { creditWallet, debitWallet } from "@/services/wallet";

const MAX_ISSUE_AMOUNT = 1_000_000;

export async function POST(req: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "업체만 포인트를 지급할 수 있습니다." },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const userId = String(body?.userId ?? "").trim();
  const amountNum = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim();

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "userId(고객)가 필요합니다." },
      { status: 400 }
    );
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json(
      { ok: false, message: "userId 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(amountNum)) {
    return NextResponse.json(
      { ok: false, message: "amount는 숫자여야 합니다." },
      { status: 400 }
    );
  }

  if (!Number.isInteger(amountNum) || amountNum < 1) {
    return NextResponse.json(
      { ok: false, message: "amount는 1 이상의 정수여야 합니다." },
      { status: 400 }
    );
  }

  if (amountNum > MAX_ISSUE_AMOUNT) {
    return NextResponse.json(
      { ok: false, message: "지급 금액이 너무 큽니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const requesterId = new mongoose.Types.ObjectId(session.uid);
  const customerId = new mongoose.Types.ObjectId(userId);

  const relation = await FavoritePartner.findOne({
    customerId,
    partnerId: requesterId,
    status: "APPLIED",
  }).lean();

  if (!relation) {
    return NextResponse.json(
      { ok: false, message: "신청한 고객에게만 포인트를 지급할 수 있습니다." },
      { status: 403 }
    );
  }

  const customer = await User.findById(customerId, {
    _id: 1,
    username: 1,
    name: 1,
    role: 1,
    status: 1,
  });

  if (!customer) {
    return NextResponse.json(
      { ok: false, message: "대상 고객을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (customer.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, message: "대상 고객이 활성 상태가 아닙니다." },
      { status: 400 }
    );
  }

  if (customer.role !== "CUSTOMER") {
    return NextResponse.json(
      { ok: false, message: "지급 대상은 CUSTOMER만 가능합니다." },
      { status: 400 }
    );
  }

  const dbSession = await mongoose.startSession();

  try {
    const result = await dbSession.withTransaction(async () => {
      const amount = amountNum;

      const debit = await debitWallet(requesterId, amount, dbSession);
      await creditWallet(customerId, amount, dbSession);

      const issue = await IssueRequest.create(
        [
          {
            userId: customerId,
            requesterId,
            adminId: null,
            amount,
            status: "APPROVED",
            note,
            decidedAt: new Date(),
            ledgerId: null,
          },
        ],
        { session: dbSession }
      );

      const issueDoc = issue[0];

      const ledgerRows = await Ledger.create(
        [
          {
            accountId: requesterId,
            userId: requesterId,
            actorId: requesterId,
            counterpartyId: customerId,
            type: "ISSUE",
            amount: -amount,
            refType: "ISSUE_REQUEST",
            refId: issueDoc._id,
            note: note ? `신청 고객 지급 차감 / ${note}` : "신청 고객 지급 차감",
          },
          {
            accountId: customerId,
            userId: customerId,
            actorId: requesterId,
            counterpartyId: requesterId,
            type: "ISSUE",
            amount: +amount,
            refType: "ISSUE_REQUEST",
            refId: issueDoc._id,
            note: note ? `신청 고객 포인트 지급 / ${note}` : "신청 고객 포인트 지급",
          },
        ],
        { session: dbSession, ordered: true }
      );

      issueDoc.ledgerId = ledgerRows[1]._id;
      await issueDoc.save({ session: dbSession });

      return {
        ok: true as const,
        issueId: String(issueDoc._id),
        ledgerId: String(ledgerRows[1]._id),
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
    if (msg.startsWith("잔액 부족:")) {
      return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}