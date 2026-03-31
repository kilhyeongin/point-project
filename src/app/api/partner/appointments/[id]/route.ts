import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { FavoritePartner } from "@/models/FavoritePartner";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "NOSHOW", "CANCELLED"];

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    if (session.role !== "PARTNER") return NextResponse.json({ ok: false, error: "접근 권한이 없습니다." }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const appointmentStatus = String(body?.appointmentStatus ?? "");

    if (!ALLOWED_STATUSES.includes(appointmentStatus)) {
      return NextResponse.json({ ok: false, error: "올바르지 않은 상태값입니다." }, { status: 400 });
    }

    await connectDB();

    const updated = await FavoritePartner.findOneAndUpdate(
      { _id: id, partnerId: session.uid },
      { $set: { appointmentStatus } },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ ok: false, error: "예약을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, appointmentStatus });
  } catch (error) {
    console.error("[PARTNER_APPOINTMENT_PATCH]", error);
    return NextResponse.json({ ok: false, error: "상태 변경에 실패했습니다." }, { status: 500 });
  }
}
