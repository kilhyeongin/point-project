// src/app/api/partner/use-requests/route.ts
// =======================================================
// PARTNER 전용: 포인트 차감요청(UseRequest) API
// -------------------------------------------------------
// GET  : 내가 만든 차감요청 목록 조회 (+ 대상 고객 정보 포함)
// POST : 차감요청 생성
//   - 방법 A) toUsername 로 생성 → PENDING (관리자 승인 필요)
//   - 방법 B) qrPayload(스캔) 로 생성 → 즉시 차감 (APPROVED)
// -------------------------------------------------------
// 정책:
// - 신청(APPLIED) 고객에게만 차감 가능
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { UseRequest } from "@/models/UseRequest";
import { Ledger } from "@/models/Ledger";
import { FavoritePartner } from "@/models/FavoritePartner";
import { debitWallet } from "@/services/wallet";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

function parseQrPayload(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.startsWith("POINTQR:")) return s.replace("POINTQR:", "").trim();
  return s;
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 접근 가능합니다." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = String(searchParams.get("status") ?? "ALL").toUpperCase();

  await connectDB();

  const filter: any = { partnerId: new mongoose.Types.ObjectId(session.uid) };
  if (["PENDING", "APPROVED", "REJECTED"].includes(statusParam)) {
    filter.status = statusParam;
  }

  const docs = await UseRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("userId", "username name");

  const items = docs.map((d: any) => ({
    id: d._id.toString(),
    status: d.status,
    amount: d.amount,
    note: d.note,
    createdAt: d.createdAt,
    decidedAt: d.decidedAt,
    to: d.userId ? { username: d.userId.username, name: d.userId.name } : null,
  }));

  return NextResponse.json(
    { ok: true, items },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (await isRateLimited(`use-req:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (await isRateLimited(`use-req:${session.uid}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 요청할 수 있습니다." }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const toUsername = String(body?.toUsername ?? "").trim().toLowerCase();
  const qrTokenRaw = String(body?.qrToken ?? "").trim();
  const qrPayloadRaw = String(body?.qrPayload ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, message: "amount는 1 이상 숫자여야 합니다." }, { status: 400 });
  }

  const HARD_MAX = 100_000_000;
  if (amount > HARD_MAX) {
    return NextResponse.json({ ok: false, message: "요청 금액이 너무 큽니다." }, { status: 400 });
  }

  await connectDB();

  let targetUser: any = null;

  if (toUsername) {
    targetUser = await User.findOne(
      { username: toUsername },
      { _id: 1, role: 1, status: 1, username: 1, name: 1 }
    );
  } else {
    const secret = process.env.QR_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, message: "QR_SECRET이 설정되어 있지 않습니다." }, { status: 500 });
    }

    const token = parseQrPayload(qrTokenRaw || qrPayloadRaw);
    if (!token) {
      return NextResponse.json({ ok: false, message: "toUsername 또는 qrToken이 필요합니다." }, { status: 400 });
    }

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

      targetUser = await User.findById(
        new mongoose.Types.ObjectId(customerId),
        { _id: 1, role: 1, status: 1, username: 1, name: 1 }
      );
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const friendly =
        m.includes("jwt expired")
          ? "QR이 만료되었습니다. 고객에게 QR을 새로고침 요청하세요."
          : "QR 검증 실패";

      return NextResponse.json({ ok: false, message: friendly }, { status: 400 });
    }
  }

  if (!targetUser) {
    return NextResponse.json({ ok: false, message: "대상 고객을 찾을 수 없습니다." }, { status: 404 });
  }
  if (targetUser.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, message: "대상 사용자가 활성 상태가 아닙니다." }, { status: 400 });
  }
  if (targetUser.role !== "CUSTOMER") {
    return NextResponse.json({ ok: false, message: "차감 대상은 고객(CUSTOMER)만 가능합니다." }, { status: 400 });
  }

  const userId = new mongoose.Types.ObjectId(String(targetUser._id));
  const partnerId = new mongoose.Types.ObjectId(session.uid);

  const relation = await FavoritePartner.findOne({
    customerId: userId,
    partnerId,
    status: "APPLIED",
  }).lean();

  if (!relation) {
    console.warn("[PARTNER_USE_REQUEST_BLOCKED]", {
      partnerId: String(partnerId),
      customerId: String(userId),
      reason: "NOT_APPLIED",
    });

    return NextResponse.json(
      { ok: false, message: "신청한 고객에게만 차감 요청을 생성할 수 있습니다." },
      { status: 403 }
    );
  }

  const isQrScan = !!(qrTokenRaw || qrPayloadRaw);

  // ── QR 스캔: 즉시 차감 (트랜잭션) ──────────────────────
  if (isQrScan) {
    const dbSession = await mongoose.startSession();
    try {
      const result = await dbSession.withTransaction(async () => {
        const doc = await UseRequest.create(
          [{ userId, partnerId, amount: Math.abs(amount), status: "PENDING", note }],
          { session: dbSession }
        );
        const req = doc[0];

        // 고객 포인트 차감 (사라짐 — 제휴사로 이동하지 않음)
        const debit = await debitWallet(userId, Math.abs(amount), dbSession);

        // Ledger: 고객 차감 1행만. counterpartyId = 제휴사 (정산 집계용)
        const ledgerDocs = await Ledger.create(
          [
            {
              accountId: userId,
              userId,
              actorId: partnerId,
              counterpartyId: partnerId,
              type: "USE",
              amount: -Math.abs(amount),
              refType: "USE_REQUEST",
              refId: req._id,
              note: note ? `QR 결제 - ${note}` : "QR 결제(차감)",
            },
          ],
          { session: dbSession, ordered: true }
        );

        req.status = "APPROVED";
        req.decidedAt = new Date();
        req.ledgerId = (ledgerDocs[0] as any)._id;
        await req.save({ session: dbSession });

        return {
          req,
          balanceBefore: debit.balanceBefore,
          balanceAfter: debit.balanceAfter,
        };
      });

      return NextResponse.json(
        {
          ok: true,
          instant: true,
          request: {
            id: result.req._id.toString(),
            to: { username: targetUser.username, name: targetUser.name },
            amount: result.req.amount,
            status: result.req.status,
            note: result.req.note,
            createdAt: result.req.createdAt,
          },
          balanceBefore: result.balanceBefore,
          balanceAfter: result.balanceAfter,
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

  // ── username 수동입력: PENDING (관리자 승인 필요) ────────
  const doc = await UseRequest.create({
    userId,
    partnerId,
    amount: Math.abs(amount),
    status: "PENDING",
    note,
  });

  return NextResponse.json(
    {
      ok: true,
      instant: false,
      request: {
        id: doc._id.toString(),
        to: { username: targetUser.username, name: targetUser.name },
        amount: doc.amount,
        status: doc.status,
        note: doc.note,
        createdAt: doc.createdAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}