// src/app/api/admin/settlements/excel/route.ts
// =======================================================
// ADMIN 전용: 정산서 엑셀 다운로드 API
// -------------------------------------------------------
// ✔ ADMIN만 접근 가능
// ✔ USE 거래를 counterpartyId 기준으로 집계
// ✔ 기간 필터: ?from=YYYY-MM-DD&to=YYYY-MM-DD
// ✔ q 검색: 상대방(username/name)
// ✔ Excel 다운로드(.xlsx)
// =======================================================

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";

function parseDateYYYYMMDD(s: string | null) {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
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
  const to = parseDateYYYYMMDD(toStr);

  await connectDB();

  const USERS_COLLECTION = "users";

  const orgId = session.orgId ?? "4nwn";

  const match: any = {
    organizationId: orgId,
    type: "USE",
    counterpartyId: { $ne: null },
  };

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }

  const pipeline: any[] = [
    { $match: match },

    {
      $group: {
        _id: "$counterpartyId",
        useCount: { $sum: 1 },
        sumAmount: { $sum: "$amount" }, // 음수 합
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
                { "counterparty.username": { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\$&"), $options: "i" } },
                { "counterparty.name": { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\$&"), $options: "i" } },
              ],
            },
          },
        ]
      : []),

    { $sort: { lastUsedAt: -1 } },
    { $limit: 500 },

    {
      $project: {
        _id: 0,
        counterpartyId: "$_id",
        useCount: 1,
        usedPoints: { $multiply: ["$sumAmount", -1] }, // 양수
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

  const rows = await Ledger.aggregate(pipeline);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "point-platform";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("정산서");

  // 헤더
  sheet.columns = [
    { header: "업체명", key: "name", width: 18 },
    { header: "아이디", key: "username", width: 18 },
    { header: "역할", key: "role", width: 12 },
    { header: "상태", key: "status", width: 12 },
    { header: "사용건수", key: "useCount", width: 12 },
    { header: "사용포인트", key: "usedPoints", width: 16 },
    { header: "마지막사용", key: "lastUsedAt", width: 22 },
    { header: "업체ID(ObjectId)", key: "counterpartyId", width: 28 },
  ];

  // 스타일(대기업 느낌: 헤더 굵게, 고정)
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 18;

  for (const r of rows) {
    const c = r.counterparty || {};
    sheet.addRow({
      name: c.name ?? "",
      username: c.username ?? "",
      role: c.role ?? "",
      status: c.status ?? "",
      useCount: Number(r.useCount ?? 0),
      usedPoints: Number(r.usedPoints ?? 0),
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleString() : "",
      counterpartyId: r.counterpartyId ? String(r.counterpartyId) : "",
    });
  }

  // 숫자 포맷
  sheet.getColumn("useCount").numFmt = "#,##0";
  sheet.getColumn("usedPoints").numFmt = "#,##0";

  // 상단 고정
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();

  // 파일명: settlements_2026-03-01_2026-03-31.xlsx
  const fname = `settlements_${fromStr ?? "all"}_${toStr ?? "all"}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}