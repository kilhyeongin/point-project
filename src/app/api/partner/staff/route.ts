import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { PartnerStaff } from "@/models/PartnerStaff";
import { User } from "@/models/User";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

async function uniqueCode(organizationId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const exists = await PartnerStaff.exists({ organizationId, code });
    if (!exists) return code;
  }
  throw new Error("코드 생성 실패");
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
  }

  await connectDB();
  const orgId = session.orgId ?? "4nwn";
  const partnerId = new mongoose.Types.ObjectId(session.uid);

  const staff = await PartnerStaff.find({ organizationId: orgId, partnerId })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  const codes = staff.map((s: any) => s.code);

  // 각 직원별 추천 가입자 수 집계
  const counts = await User.aggregate([
    {
      $match: {
        organizationId: orgId,
        role: "CUSTOMER",
        "customerProfile.referralCode": { $in: codes },
      },
    },
    {
      $group: {
        _id: "$customerProfile.referralCode",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap: Record<string, number> = {};
  for (const c of counts) {
    countMap[c._id] = c.count;
  }

  const result = staff.map((s: any) => ({
    id: String(s._id),
    name: s.name,
    code: s.code,
    isActive: s.isActive,
    referralCount: countMap[s.code] ?? 0,
    createdAt: s.createdAt,
  }));

  return NextResponse.json({ ok: true, staff: result });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim().slice(0, 50);

    if (!name) {
      return NextResponse.json({ ok: false, error: "직원 이름을 입력해 주세요." }, { status: 400 });
    }

    await connectDB();
    const orgId = session.orgId ?? "4nwn";
    const partnerId = new mongoose.Types.ObjectId(session.uid);

    // 직원 수 제한 (제휴사당 100명)
    const count = await PartnerStaff.countDocuments({ organizationId: orgId, partnerId });
    if (count >= 100) {
      return NextResponse.json({ ok: false, error: "직원은 최대 100명까지 등록할 수 있습니다." }, { status: 400 });
    }

    const code = await uniqueCode(orgId);

    const staff = await PartnerStaff.create({
      organizationId: orgId,
      partnerId,
      name,
      code,
    });

    return NextResponse.json({
      ok: true,
      staff: {
        id: String(staff._id),
        name: staff.name,
        code: staff.code,
        isActive: staff.isActive,
        referralCount: 0,
        createdAt: staff.createdAt,
      },
    });
  } catch (error) {
    console.error("[PARTNER_STAFF_POST_ERROR]", error);
    return NextResponse.json({ ok: false, error: "직원 등록에 실패했습니다." }, { status: 500 });
  }
}
