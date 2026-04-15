import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

// GET: 저장된 컬럼 템플릿 조회
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.role !== "PARTNER") return NextResponse.json({ ok: false }, { status: 403 });

  await connectDB();

  const user = await User.findOne(
    { _id: session.uid, organizationId: session.orgId ?? "4nwn" },
    { "partnerProfile.settlementColumns": 1 }
  ).lean() as any;

  const columns: string[] = user?.partnerProfile?.settlementColumns ?? [];

  return NextResponse.json({ ok: true, columns });
}

// PUT: 컬럼 템플릿 저장 (정산서 저장 시 자동 호출)
export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.role !== "PARTNER") return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json();
  const columns = Array.isArray(body?.columns)
    ? body.columns.map((c: unknown) => String(c ?? "").trim()).filter(Boolean).slice(0, 30)
    : null;

  if (!columns || columns.length === 0) {
    return NextResponse.json({ ok: false, message: "컬럼 목록이 없습니다." }, { status: 400 });
  }

  await connectDB();

  await User.updateOne(
    { _id: session.uid, organizationId: session.orgId ?? "4nwn", role: "PARTNER" },
    { $set: { "partnerProfile.settlementColumns": columns } }
  );

  return NextResponse.json({ ok: true });
}
