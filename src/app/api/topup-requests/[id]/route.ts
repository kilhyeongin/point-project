import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { TopupRequest } from "@/models/TopupRequest";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "업체만 접근 가능합니다." },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { ok: false, message: "잘못된 요청 ID입니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const doc = await TopupRequest.findOne({
    _id: new mongoose.Types.ObjectId(id),
    accountId: new mongoose.Types.ObjectId(session.uid),
    organizationId: session.orgId ?? "4nwn",
  });

  if (!doc) {
    return NextResponse.json(
      { ok: false, message: "요청을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (doc.status !== "PENDING") {
    return NextResponse.json(
      { ok: false, message: "대기 중인 요청만 취소할 수 있습니다." },
      { status: 400 }
    );
  }

  await doc.deleteOne();

  return NextResponse.json({ ok: true });
}
