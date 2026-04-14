import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "권한 없음" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      businessName,
      businessNumber,
      contactName,
      username,
      password,
      contactPhone,
      address,
      organizationId = "4nwn",
    } = body;

    await connectDB();

    const exists = await User.findOne({ username, organizationId }, { _id: 1 }).lean();
    if (exists) {
      return NextResponse.json({ ok: false, error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      organizationId,
      username,
      passwordHash,
      name: businessName,
      role: "PARTNER",
      status: "PENDING",
      pointBalance: 0,
      partnerProfile: {
        businessName,
        businessNumber,
        contactName,
        contactPhone,
        contactEmail: "",
        address,
        detailAddress: "",
        phone: contactPhone,
        category: "",
        categories: [],
        intro: "",
        benefitText: "",
        kakaoChannelUrl: "",
        applyUrl: "",
        coverImageUrl: "",
        isPublished: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DEV_CREATE_PARTNER]", err);
    return NextResponse.json({ ok: false, error: "생성 실패" }, { status: 500 });
  }
}
