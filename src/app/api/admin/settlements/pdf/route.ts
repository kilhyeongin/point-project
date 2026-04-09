// src/app/api/admin/settlements/pdf/route.ts
// =======================================================
// ADMIN: 정산서 PDF
// -------------------------------------------------------
// - 수수료 없음
// - 지급액 = netPayable
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { PDFDocument, rgb } from "pdf-lib";
import * as fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";
import { User } from "@/models/User";

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, message: "관리자만 접근 가능합니다." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const periodKey = String(searchParams.get("periodKey") ?? "").trim();
  const counterpartyId = String(searchParams.get("counterpartyId") ?? "").trim();

  if (!periodKey || !mongoose.Types.ObjectId.isValid(counterpartyId)) {
    return NextResponse.json(
      { ok: false, message: "periodKey / counterpartyId를 확인해주세요." },
      { status: 400 }
    );
  }

  await connectDB();

  const orgId = session.orgId ?? "default";

  const doc = await Settlement.findOne({
    organizationId: orgId,
    periodKey,
    counterpartyId: new mongoose.Types.ObjectId(counterpartyId),
  }).lean();

  if (!doc) {
    return NextResponse.json(
      { ok: false, message: "정산 데이터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const counterparty = await User.findOne({
    _id: counterpartyId,
    organizationId: orgId,
  }, {
    username: 1,
    name: 1,
  }).lean();

  // 한글 지원 폰트 임베드
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansKR-Regular.ttf");
  const fontBytes = new Uint8Array(fs.readFileSync(fontPath));
  const font = await pdf.embedFont(fontBytes);

  const page = pdf.addPage([595, 842]);

  let y = 790;

  function drawLine(text: string, size = 12) {
    page.drawText(text, {
      x: 50,
      y,
      size,
      font,
    });
    y -= size + 10;
  }

  function drawHr() {
    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 18;
  }

  const partnerName = (counterparty as any)?.name ?? "-";
  const partnerUsername = (counterparty as any)?.username ?? "-";
  const useCount = Number((doc as any).useCount ?? 0);
  const usedPoints = Number((doc as any).usedPoints ?? 0);
  const netPayable = Number((doc as any).netPayable ?? usedPoints);
  const status = String((doc as any).status ?? "");
  const statusLabel = status === "PAID" ? "지급완료" : status === "OPEN" ? "미지급" : status;
  const closedAt = (doc as any).closedAt ? new Date((doc as any).closedAt).toLocaleDateString("ko-KR") : "-";
  const paidAt = (doc as any).paidAt ? new Date((doc as any).paidAt).toLocaleDateString("ko-KR") : "-";

  drawLine("정  산  서", 20);
  y -= 6;
  drawHr();

  drawLine(`정산 기간: ${periodKey}`, 12);
  drawLine(`마감일: ${closedAt}`, 12);
  drawHr();

  drawLine(`제휴사: ${partnerName} (${partnerUsername})`, 12);
  drawLine(`상태: ${statusLabel}`, 12);
  y -= 6;
  drawHr();

  drawLine(`차감 건수: ${formatNumber(useCount)}건`, 12);
  drawLine(`차감 포인트: ${formatNumber(usedPoints)}P`, 12);
  y -= 6;
  drawHr();

  drawLine(`지급액: ${formatNumber(netPayable)}P`, 16);

  if (status === "PAID") {
    y -= 6;
    drawLine(`지급일: ${paidAt}`, 12);
    const payoutRef = String((doc as any).payoutRef ?? "").trim();
    if (payoutRef) drawLine(`지급 참조번호: ${payoutRef}`, 12);
  }

  const pdfBytes = await pdf.save();
  const body = Buffer.from(pdfBytes);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="settlement-${periodKey}-${partnerUsername}.pdf"`,
    },
  });
}