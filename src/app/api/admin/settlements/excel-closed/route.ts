// src/app/api/admin/settlements/excel-closed/route.ts
// =======================================================
// ADMIN: 마감된 정산 엑셀 다운로드
// -------------------------------------------------------
// query:
// - periodKey=YYYY-MM
//
// 표시 규칙:
// - feeRate 저장값이 0.1 이면 엑셀에는 10.00% 로 표시
// =======================================================

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";

function formatNumber(n: number) {
  return Number(n || 0);
}

function formatPercentFromDecimal(decimal: number) {
  return `${(Number(decimal || 0) * 100).toFixed(2)}%`;
}

function safeString(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function formatDateTime(v?: string | Date | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR");
}

function getCounterpartyInfo(doc: any) {
  const cp = doc?.counterpartySnapshot ?? doc?.counterparty ?? null;

  return {
    id: safeString(cp?.id ?? doc?.counterpartyId ?? "", ""),
    username: safeString(cp?.username, ""),
    name: safeString(cp?.name, ""),
    role: safeString(cp?.role, ""),
    status: safeString(cp?.status, ""),
  };
}

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const periodKey = String(searchParams.get("periodKey") ?? "").trim();

  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    return NextResponse.json(
      { ok: false, message: "periodKey는 YYYY-MM 형식이어야 합니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const docs = await Settlement.find({ periodKey })
    .sort({ createdAt: 1 })
    .lean();

  const rows = docs.map((doc: any, index: number) => {
    const cp = getCounterpartyInfo(doc);

    return {
      No: index + 1,
      정산월: safeString(doc?.periodKey, periodKey),
      시작일: safeString(doc?.from, ""),
      종료일: safeString(doc?.to, ""),
      업체명: cp.name,
      업체아이디: cp.username,
      업체역할: cp.role,
      업체상태: cp.status,
      업체ID: cp.id,
      정산상태: safeString(doc?.status, "OPEN"),
      사용건수: formatNumber(doc?.useCount),
      사용포인트: formatNumber(doc?.usedPoints),
      수수료율: formatPercentFromDecimal(Number(doc?.feeRate ?? 0)),
      수수료율_원값: Number(doc?.feeRate ?? 0),
      수수료: formatNumber(doc?.feeAmount),
      지급금액: formatNumber(doc?.netPayable),
      마지막사용일시: formatDateTime(doc?.lastUsedAt),
      마감일시: formatDateTime(doc?.closedAt),
      지급일시: formatDateTime(doc?.paidAt),
      지급참조: safeString(doc?.payoutRef, ""),
      메모: safeString(doc?.note, ""),
      생성일시: formatDateTime(doc?.createdAt),
      수정일시: formatDateTime(doc?.updatedAt),
    };
  });

  const summary = docs.reduce(
    (acc: any, doc: any) => {
      acc.업체수 += 1;
      acc.사용건수 += Number(doc?.useCount ?? 0);
      acc.사용포인트 += Number(doc?.usedPoints ?? 0);
      acc.수수료 += Number(doc?.feeAmount ?? 0);
      acc.지급금액 += Number(doc?.netPayable ?? 0);
      return acc;
    },
    {
      정산월: periodKey,
      업체수: 0,
      사용건수: 0,
      사용포인트: 0,
      수수료: 0,
      지급금액: 0,
    }
  );

  const wb = XLSX.utils.book_new();

  const wsData = XLSX.utils.json_to_sheet(rows);
  const wsSummary = XLSX.utils.json_to_sheet([summary]);

  // 컬럼 너비
  wsData["!cols"] = [
    { wch: 6 },   // No
    { wch: 10 },  // 정산월
    { wch: 12 },  // 시작일
    { wch: 12 },  // 종료일
    { wch: 18 },  // 업체명
    { wch: 18 },  // 업체아이디
    { wch: 12 },  // 업체역할
    { wch: 12 },  // 업체상태
    { wch: 28 },  // 업체ID
    { wch: 12 },  // 정산상태
    { wch: 10 },  // 사용건수
    { wch: 14 },  // 사용포인트
    { wch: 12 },  // 수수료율
    { wch: 12 },  // 수수료율_원값
    { wch: 12 },  // 수수료
    { wch: 14 },  // 지급금액
    { wch: 20 },  // 마지막사용일시
    { wch: 20 },  // 마감일시
    { wch: 20 },  // 지급일시
    { wch: 24 },  // 지급참조
    { wch: 24 },  // 메모
    { wch: 20 },  // 생성일시
    { wch: 20 },  // 수정일시
  ];

  wsSummary["!cols"] = [
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, "요약");
  XLSX.utils.book_append_sheet(wb, wsData, "정산라인");

  const buffer = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
  });

  const filename = `settlements-closed-${periodKey}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}