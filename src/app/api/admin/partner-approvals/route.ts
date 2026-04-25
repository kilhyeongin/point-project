import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "관리자만 접근할 수 있습니다." },
      { status: 403 }
    );
  }

  try {
    await connectDB();

    const orgId = session.orgId ?? "4nwn";

    const users = await User.find(
      {
        organizationId: orgId,
        role: "PARTNER",
        status: "PENDING",
      },
      {
        username: 1,
        name: 1,
        role: 1,
        status: 1,
        createdAt: 1,
        partnerProfile: 1,
      }
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const items = users.map((u: any) => ({
      id: String(u._id),
      username: String(u.username ?? ""),
      name: String(u.name ?? ""),
      role: String(u.role ?? ""),
      status: String(u.status ?? ""),
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : "",
      partnerProfile: {
        businessName: String(u.partnerProfile?.businessName ?? ""),
        contactName: String(u.partnerProfile?.contactName ?? ""),
        contactPhone: String(u.partnerProfile?.contactPhone ?? ""),
        address: String(u.partnerProfile?.address ?? ""),
        detailAddress: String(u.partnerProfile?.detailAddress ?? ""),
      },
    }));

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_APPROVALS_GET_ERROR]", error);
    return NextResponse.json({ ok: false, error: "파트너 승인 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}