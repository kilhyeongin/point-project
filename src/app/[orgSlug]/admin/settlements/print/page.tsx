// src/app/[orgSlug]/admin/settlements/print/page.tsx
// =======================================================
// ADMIN: 정산서 인쇄 페이지 (브라우저 인쇄 → PDF 저장)
// =======================================================

import { redirect } from "next/navigation";
import mongoose from "mongoose";
import PrintButton from "./PrintButton";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Settlement } from "@/models/Settlement";
import { User } from "@/models/User";

function fmt(n: number) {
  return Number(n || 0).toLocaleString("ko-KR");
}

function fmtDate(v: unknown) {
  if (!v) return "-";
  try {
    return new Date(v as string).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

type Props = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ periodKey?: string; counterpartyId?: string }>;
};

export default async function SettlementPrintPage({ params, searchParams }: Props) {
  const { orgSlug } = await params;
  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN") redirect(`/${orgSlug}/login`);

  const { periodKey, counterpartyId } = await searchParams;

  if (!periodKey || !counterpartyId || !mongoose.Types.ObjectId.isValid(counterpartyId)) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif" }}>
        <p>잘못된 요청입니다. periodKey와 counterpartyId를 확인해주세요.</p>
      </div>
    );
  }

  await connectDB();

  const orgId = session.orgId ?? "4nwn";

  const [doc, counterparty] = await Promise.all([
    Settlement.findOne({
      organizationId: orgId,
      periodKey,
      counterpartyId: new mongoose.Types.ObjectId(counterpartyId),
    }).lean(),
    User.findOne({ _id: counterpartyId, organizationId: orgId }, { username: 1, name: 1, email: 1 }).lean(),
  ]);

  if (!doc) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif" }}>
        <p>정산 데이터를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const d = doc as any;
  const c = counterparty as any;

  const statusLabel =
    d.status === "PAID" ? "지급완료" : d.status === "OPEN" ? "미지급" : d.status;

  const rows = [
    { label: "정산 기간", value: periodKey },
    { label: "집계 기간", value: `${d.from ?? "-"} ~ ${d.to ?? "-"}` },
    { label: "마감일", value: fmtDate(d.closedAt) },
    { label: "제휴사명", value: c?.name ?? "-" },
    { label: "아이디", value: c?.username ?? "-" },
    { label: "상태", value: statusLabel },
    { label: "차감 건수", value: `${fmt(d.useCount ?? 0)} 건` },
    { label: "차감 포인트", value: `${fmt(d.usedPoints ?? 0)} P` },
    { label: "지급액", value: `${fmt(d.netPayable ?? 0)} P`, highlight: true },
    ...(d.status === "PAID"
      ? [
          { label: "지급일", value: fmtDate(d.paidAt) },
          ...(d.payoutRef ? [{ label: "지급 참조번호", value: d.payoutRef }] : []),
          ...(d.note ? [{ label: "메모", value: d.note }] : []),
        ]
      : []),
  ];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f5f5f5; }
        .wrap {
          max-width: 680px;
          margin: 40px auto;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 12px;
          padding: 48px 56px;
          font-family: "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
          color: #111;
        }
        h1 {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 8px;
          text-align: center;
          margin-bottom: 32px;
          border-bottom: 2px solid #111;
          padding-bottom: 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        td {
          padding: 10px 12px;
          font-size: 14px;
          border-bottom: 1px solid #eee;
          vertical-align: top;
        }
        td:first-child {
          color: #666;
          width: 130px;
          white-space: nowrap;
        }
        td:last-child {
          font-weight: 600;
        }
        .highlight td {
          background: #f8f8f8;
          font-size: 16px;
          font-weight: 900;
          color: #111;
        }
        .highlight td:first-child { color: #444; }
        .footer {
          margin-top: 48px;
          font-size: 12px;
          color: #aaa;
          text-align: center;
        }
        .print-btn {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
          gap: 8px;
        }
        .print-btn button {
          padding: 10px 28px;
          border-radius: 8px;
          border: none;
          background: #111;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .print-btn a {
          padding: 10px 28px;
          border-radius: 8px;
          border: 1px solid #ddd;
          background: #fff;
          color: #333;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }
        @media print {
          body { background: #fff; }
          .print-btn { display: none !important; }
          header, nav, aside { display: none !important; }
          .wrap {
            margin: 0;
            border: none;
            border-radius: 0;
            padding: 40px;
            max-width: 100%;
          }
        }
      `}</style>

      <div className="print-btn">
        <PrintButton />
        <a href={`/${orgSlug}/admin/settlements`}>← 정산 목록으로</a>
      </div>

      <div className="wrap">
        <h1>정  산  서</h1>

        <table>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={row.highlight ? "highlight" : ""}>
                <td>{row.label}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="footer">
          본 정산서는 시스템에서 자동 생성되었습니다. · 발행일: {fmtDate(new Date().toISOString())}
        </div>
      </div>
    </>
  );
}
