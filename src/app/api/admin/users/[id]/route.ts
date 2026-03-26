import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getWalletBalancesMap } from "@/services/wallet";
import mongoose from "mongoose";

// 전화번호 부분 마스킹: 010-1234-5678 → 010-****-5678
function maskPhone(phone?: string): string {
  if (!phone) return "";
  return phone.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, "$1-****-$3");
}

// 사업자등록번호 부분 마스킹: 1234567890 → 123-**-67890
function maskBusinessNumber(num?: string): string {
  if (!num) return "";
  const d = num.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-**-${d.slice(5)}`;
  return num;
}

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "관리자만 접근 가능합니다." }, { status: 403 });
  }

  const { id } = await params;

  await connectDB();

  const user = await User.findById(id, {
    username: 1,
    name: 1,
    email: 1,
    role: 1,
    status: 1,
    createdAt: 1,
    customerProfile: 1,
    partnerProfile: 1,
  }).lean();

  if (!user) {
    return NextResponse.json({ ok: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const balanceMap = await getWalletBalancesMap([new mongoose.Types.ObjectId(id)]);

  const u = user as any;
  return NextResponse.json({
    ok: true,
    user: {
      id: String(u._id),
      username: u.username,
      name: u.name,
      email: u.email ?? "",
      role: u.role,
      status: u.status,
      balance: balanceMap.get(id) ?? 0,
      createdAt: u.createdAt,
      customerProfile: u.customerProfile
        ? {
            ...u.customerProfile,
            phone: maskPhone(u.customerProfile.phone),
            address: u.customerProfile.address ?? "",
            detailAddress: u.customerProfile.detailAddress ?? "",
          }
        : null,
      partnerProfile: u.partnerProfile
        ? {
            ...u.partnerProfile,
            businessNumber: maskBusinessNumber(u.partnerProfile.businessNumber),
            contactPhone: maskPhone(u.partnerProfile.contactPhone),
            phone: maskPhone(u.partnerProfile.phone),
          }
        : null,
    },
  });
}
