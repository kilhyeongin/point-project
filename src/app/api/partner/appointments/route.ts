import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { FavoritePartner } from "@/models/FavoritePartner";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    if (session.role !== "PARTNER") return NextResponse.json({ ok: false, error: "접근 권한이 없습니다." }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const q = searchParams.get("q")?.trim() ?? "";

    await connectDB();

    const dateFilter: Record<string, unknown> = {};
    if (start) dateFilter.$gte = new Date(start);
    if (end) {
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    const query: Record<string, unknown> = {
      partnerId: session.uid,
      status: "APPLIED",
      appointmentAt: { $ne: null, ...(Object.keys(dateFilter).length ? dateFilter : {}) },
    };

    const relations = await FavoritePartner.find(query)
      .sort({ appointmentAt: 1 })
      .lean();

    const customerIds = relations.map((r) => (r as any).customerId);
    const customers = await User.find(
      { _id: { $in: customerIds } },
      { name: 1, username: 1, "customerProfile.phone": 1 }
    ).lean();

    const customerMap = new Map(customers.map((c: any) => [String(c._id), c]));

    let items = relations.map((r: any) => {
      const customer = customerMap.get(String(r.customerId));
      return {
        id: String(r._id),
        customerId: String(r.customerId),
        customerName: String((customer as any)?.name ?? ""),
        customerUsername: String((customer as any)?.username ?? ""),
        customerPhone: String((customer as any)?.customerProfile?.phone ?? ""),
        appointmentAt: r.appointmentAt ? new Date(r.appointmentAt).toISOString() : null,
        appointmentNote: String(r.appointmentNote ?? ""),
        appointmentStatus: String(r.appointmentStatus ?? "PENDING"),
        appliedAt: r.appliedAt ? new Date(r.appliedAt).toISOString() : null,
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
      };
    });

    if (q) {
      const lower = q.toLowerCase();
      items = items.filter(
        (item) =>
          item.customerName.toLowerCase().includes(lower) ||
          item.customerUsername.toLowerCase().includes(lower) ||
          item.customerPhone.includes(q)
      );
    }

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[PARTNER_APPOINTMENTS_GET]", error);
    return NextResponse.json({ ok: false, error: "예약 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
