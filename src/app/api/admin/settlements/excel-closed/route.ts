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
import ExcelJS from "exceljs";
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
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "관리자만 접근 가능합니다." }, { status: 403 });
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

  const docs = await Settlement.find({ periodKey }).sort({ createdAt: 1 }).lean();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "point-platform";
  workbook.created = new Date();

  // ── 요약 시트 ──────────────────────────────────────────
  const summary = docs.reduce(
    (acc: any, doc: any) => {
      acc.업체수 += 1;
      acc.사용건수 += Number(doc?.useCount ?? 0);
      acc.사용포인트 += Number(doc?.usedPoints ?? 0);
      acc.수수료 += Number(doc?.feeAmount ?? 0);
      acc.지급금액 += Number(doc?.netPayable ?? 0);
      return acc;
    },
    { 정산월: periodKey, 업체수: 0, 사용건수: 0, 사용포인트: 0, 수수료: 0, 지급금액: 0 }
  );

  const summarySheet = workbook.addWorksheet("요약");
  summarySheet.columns = [
    { header: "정산월", key: "정산월", width: 10 },
    { header: "업체수", key: "업체수", width: 10 },
    { header: "사용건수", key: "사용건수", width: 12 },
    { header: "사용포인트", key: "사용포인트", width: 14 },
    { header: "수수료", key: "수수료", width: 12 },
    { header: "지급금액", key: "지급금액", width: 14 },
  ];
  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = { bold: true };
  summaryHeader.alignment = { vertical: "middle", horizontal: "center" };
  summarySheet.addRow(summary);
  summarySheet.getColumn("사용건수").numFmt = "#,##0";
  summarySheet.getColumn("사용포인트").numFmt = "#,##0";
  summarySheet.getColumn("수수료").numFmt = "#,##0";
  summarySheet.getColumn("지급금액").numFmt = "#,##0";

  // ── 정산라인 시트 ──────────────────────────────────────
  const dataSheet = workbook.addWorksheet("정산라인");
  dataSheet.columns = [
    { header: "No", key: "No", width: 6 },
    { header: "정산월", key: "정산월", width: 10 },
    { header: "시작일", key: "시작일", width: 12 },
    { header: "종료일", key: "종료일", width: 12 },
    { header: "업체명", key: "업체명", width: 18 },
    { header: "업체아이디", key: "업체아이디", width: 18 },
    { header: "업체역할", key: "업체역할", width: 12 },
    { header: "업체상태", key: "업체상태", width: 12 },
    { header: "업체ID", key: "업체ID", width: 28 },
    { header: "정산상태", key: "정산상태", width: 12 },
    { header: "사용건수", key: "사용건수", width: 10 },
    { header: "사용포인트", key: "사용포인트", width: 14 },
    { header: "수수료율", key: "수수료율", width: 12 },
    { header: "수수료율_원값", key: "수수료율_원값", width: 12 },
    { header: "수수료", key: "수수료", width: 12 },
    { header: "지급금액", key: "지급금액", width: 14 },
    { header: "마지막사용일시", key: "마지막사용일시", width: 20 },
    { header: "마감일시", key: "마감일시", width: 20 },
    { header: "지급일시", key: "지급일시", width: 20 },
    { header: "지급참조", key: "지급참조", width: 24 },
    { header: "메모", key: "메모", width: 24 },
    { header: "생성일시", key: "생성일시", width: 20 },
    { header: "수정일시", key: "수정일시", width: 20 },
  ];

  const dataHeader = dataSheet.getRow(1);
  dataHeader.font = { bold: true };
  dataHeader.alignment = { vertical: "middle", horizontal: "center" };
  dataSheet.views = [{ state: "frozen", ySplit: 1 }];

  docs.forEach((doc: any, index: number) => {
    const cp = getCounterpartyInfo(doc);
    dataSheet.addRow({
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
    });
  });

  dataSheet.getColumn("사용건수").numFmt = "#,##0";
  dataSheet.getColumn("사용포인트").numFmt = "#,##0";
  dataSheet.getColumn("수수료").numFmt = "#,##0";
  dataSheet.getColumn("지급금액").numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `settlements-closed-${periodKey}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
