import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import {
  getPartnerCategoryMasters,
  normalizeCategoryCodes,
} from "@/lib/partnerCategories";

async function buildInterestOptions(orgId: string) {
  const items = await getPartnerCategoryMasters({
    activeOnly: true,
    visibleToCustomerOnly: true,
    orgId,
  });

  return items.map((item) => ({
    value: item.code,
    label: item.name,
  }));
}

export async function GET() {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (session.role !== "CUSTOMER") {
      return NextResponse.json(
        { ok: false, error: "고객만 접근할 수 있습니다." },
        { status: 403 }
      );
    }

    await connectDB();

    const me = await User.findOne(
      { _id: session.uid, organizationId: session.orgId ?? "4nwn" },
      {
        customerProfile: 1,
      }
    ).lean();

    if (!me) {
      return NextResponse.json(
        { ok: false, error: "고객 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const customerProfile = (me as any).customerProfile ?? {};

    return NextResponse.json({
      ok: true,
      onboardingCompleted: Boolean(customerProfile.onboardingCompleted),
      interests: Array.isArray(customerProfile.interests)
        ? customerProfile.interests
        : [],
      interestOptions: await buildInterestOptions(session.orgId ?? "4nwn"),
    });
  } catch (error) {
    console.error("[CUSTOMER_ONBOARDING_GET_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "관심사 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (session.role !== "CUSTOMER") {
      return NextResponse.json(
        { ok: false, error: "고객만 접근할 수 있습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();

    await connectDB();

    const interests = await normalizeCategoryCodes(body?.interests, undefined, {
      onlyActive: true,
      visibleToCustomerOnly: true,
      orgId: session.orgId ?? "4nwn",
    });

    if (interests.length === 0) {
      return NextResponse.json(
        { ok: false, error: "관심사를 1개 이상 선택해 주세요." },
        { status: 400 }
      );
    }

    const updated = await User.findOneAndUpdate(
      {
        _id: session.uid,
        organizationId: session.orgId ?? "4nwn",
        role: "CUSTOMER",
      },
      {
        $set: {
          "customerProfile.interests": interests,
          "customerProfile.onboardingCompleted": true,
        },
      },
      {
        new: true,
        projection: {
          customerProfile: 1,
        },
      }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "고객 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "관심사가 저장되었습니다.",
      onboardingCompleted: true,
      interests,
    });
  } catch (error) {
    console.error("[CUSTOMER_ONBOARDING_PUT_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "관심사를 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}