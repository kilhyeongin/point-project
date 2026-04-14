import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { FavoritePartner } from "@/models/FavoritePartner";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "NOSHOW", "CANCELLED"];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기중",
  CONFIRMED: "확정",
  COMPLETED: "이용완료",
  NOSHOW: "노쇼",
  CANCELLED: "취소",
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    if (session.role !== "PARTNER") return NextResponse.json({ ok: false, error: "접근 권한이 없습니다." }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    await connectDB();

    const orgId = session.orgId ?? "4nwn";

    // 직원 메모 저장
    if (typeof body?.staffMemo === "string") {
      const updated = await FavoritePartner.findOneAndUpdate(
        { _id: id, organizationId: orgId, partnerId: session.uid },
        { $set: { staffMemo: body.staffMemo.slice(0, 500) } },
        { new: true }
      ).lean();
      if (!updated) return NextResponse.json({ ok: false, error: "예약을 찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    // 상태 변경
    const appointmentStatus = String(body?.appointmentStatus ?? "");
    if (!ALLOWED_STATUSES.includes(appointmentStatus)) {
      return NextResponse.json({ ok: false, error: "올바르지 않은 상태값입니다." }, { status: 400 });
    }

    // 예약 취소: 이용일 하루 전(자정) 이후 불가
    if (appointmentStatus === "CANCELLED") {
      const appt = await FavoritePartner.findOne(
        { _id: id, organizationId: orgId, partnerId: session.uid },
        { appointmentAt: 1 }
      ).lean() as any;

      if (appt?.appointmentAt) {
        const apptDate = new Date(appt.appointmentAt);
        const apptMidnight = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate(), 0, 0, 0, 0);
        const now_ = new Date();
        if (now_ >= apptMidnight) {
          return NextResponse.json(
            { ok: false, error: "이용일 당일에는 예약을 취소할 수 없습니다. 노쇼 처리를 이용해주세요." },
            { status: 400 }
          );
        }
      }
    }

    const now = new Date();
    const statusUpdate: Record<string, unknown> = { appointmentStatus };
    if (appointmentStatus === "CONFIRMED") statusUpdate.confirmedAt = now;
    if (appointmentStatus === "CANCELLED" || appointmentStatus === "NOSHOW") statusUpdate.cancelledAt = now;

    const historyEntry = {
      status: appointmentStatus,
      label: STATUS_LABEL[appointmentStatus] ?? appointmentStatus,
      note: "파트너센터",
      at: now,
    };

    const updated = await FavoritePartner.findOneAndUpdate(
      { _id: id, organizationId: orgId, partnerId: session.uid },
      {
        $set: statusUpdate,
        $push: { statusHistory: { $each: [historyEntry], $position: 0 } },
      },
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
