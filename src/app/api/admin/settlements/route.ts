// src/app/api/admin/settlements/route.ts
// =======================================================
// ADMIN 전용: 월정산(기간 필터) 집계 API
// -------------------------------------------------------
// ✔ ADMIN만 접근 가능
// ✔ USE 거래를 counterpartyId(상대방) 기준으로 집계
// ✔ 기간 필터: ?from=YYYY-MM-DD&to=YYYY-MM-DD
// ✔ q 검색: 상대방(username/name)
// ✔ 반환: 상대방 정보 + 사용건수 + 사용포인트(양수) + 마지막 사용시각
// =======================================================

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
import { User } from "@/models/User";
import mongoose from "mongoose";

function parseDateYYYYMMDD(s: string | null, endOfDay = false) {
  if (!s) return null;
  // "2026-03-01" 형태만 받는 간단 방어
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const suffix = endOfDay ? "T23:59:59.999+09:00" : "T00:00:00.000+09:00";
  const d = new Date(`${s}${suffix}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "관리자만 접근 가능합니다." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();

  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const from = parseDateYYYYMMDD(fromStr);
  const to = parseDateYYYYMMDD(toStr, true);

  await connectDB();

  // User 모델에서 실제 컬렉션 이름 참조 (하드코딩 방지)
  const USERS_COLLECTION = User.collection.name;

  const orgId = session.orgId ?? "4nwn";

  const match: any = {
    organizationId: orgId,
    type: "USE",
    counterpartyId: { $ne: null },
  };

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  const pipeline: any[] = [
    { $match: match },

    {
      $group: {
        _id: "$counterpartyId",
        useCount: { $sum: 1 },
        sumAmount: { $sum: "$amount" }, // USE는 음수 합계
        lastUsedAt: { $max: "$createdAt" },
      },
    },

    {
      $lookup: {
        from: USERS_COLLECTION,
        localField: "_id",
        foreignField: "_id",
        as: "counterparty",
      },
    },
    { $unwind: { path: "$counterparty", preserveNullAndEmptyArrays: true } },

    ...(q
      ? [
          {
            $match: {
              $or: [
                // 특수문자 이스케이프로 ReDoS 방지
                { "counterparty.username": { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
                { "counterparty.name": { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
              ],
            },
          },
        ]
      : []),

    { $sort: { lastUsedAt: -1 } },
    { $limit: 200 },

    {
      $project: {
        _id: 0,
        counterpartyId: "$_id",
        useCount: 1,
        usedPoints: { $multiply: ["$sumAmount", -1] }, // 양수로 변환
        lastUsedAt: 1,
        counterparty: {
          _id: "$counterparty._id",
          username: "$counterparty.username",
          name: "$counterparty.name",
          role: "$counterparty.role",
          status: "$counterparty.status",
        },
      },
    },
  ];

  try {
    const rows = await Ledger.aggregate(pipeline);

    const items = rows.map((r: any) => ({
      counterpartyId: r.counterpartyId ? String(r.counterpartyId) : null,
      counterparty: r.counterparty?._id
        ? {
            id: String(r.counterparty._id),
            username: r.counterparty.username ?? "",
            name: r.counterparty.name ?? "",
            role: r.counterparty.role ?? "",
            status: r.counterparty.status ?? "",
          }
        : null,
      useCount: Number(r.useCount ?? 0),
      usedPoints: Number(r.usedPoints ?? 0),
      lastUsedAt: r.lastUsedAt ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    const msg = String(e?.message ?? "서버 오류");
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}