import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  await connectDB();

  const user = await User.findOne({ _id: session.uid, organizationId: session.orgId ?? "default" })
    .select("name email customerProfile socialAccounts")
    .lean() as any;

  if (!user) {
    return NextResponse.json({ ok: false, message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const socialAccounts: { provider: string }[] = user.socialAccounts ?? [];
  const socialProvider = socialAccounts.length > 0 ? socialAccounts[0].provider : null;

  return NextResponse.json({
    ok: true,
    profile: {
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.customerProfile?.phone ?? "",
      address: user.customerProfile?.address ?? "",
      detailAddress: user.customerProfile?.detailAddress ?? "",
      socialProvider,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const { email, phone, address, detailAddress } = body;

  await connectDB();

  await User.findOneAndUpdate({ _id: session.uid, organizationId: session.orgId ?? "default" }, {
    ...(email !== undefined && { email: String(email).trim().toLowerCase() }),
    ...(phone !== undefined && { "customerProfile.phone": String(phone).trim() }),
    ...(address !== undefined && { "customerProfile.address": String(address).trim() }),
    ...(detailAddress !== undefined && { "customerProfile.detailAddress": String(detailAddress).trim() }),
  });

  return NextResponse.json({ ok: true, message: "저장되었습니다." });
}
