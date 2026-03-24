// src/app/api/customer/favorites/[partnerId]/route.ts
// =======================================================
// CUSTOMER 관심업체 등록 / 해제
// -------------------------------------------------------
// POST   : 관심업체 등록(LIKED)
// DELETE : 관심업체 해제
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { FavoritePartner } from "@/models/FavoritePartner";

type Params = {
  params: Promise<{ partnerId: string }>;
};

function unauthorized(message = "로그인이 필요합니다.") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function forbidden(message = "고객만 사용할 수 있습니다.") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

async function validatePartner(partnerId: string) {
  if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
    return {
      ok: false as const,
      response: badRequest("유효한 partnerId가 필요합니다."),
    };
  }

  const partner = await User.findOne(
    {
      _id: new mongoose.Types.ObjectId(partnerId),
      role: "PARTNER",
      status: "ACTIVE",
      "partnerProfile.isPublished": true,
    },
    {
      _id: 1,
    }
  ).lean();

  if (!partner) {
    return {
      ok: false as const,
      response: notFound("존재하지 않거나 공개되지 않은 업체입니다."),
    };
  }

  return { ok: true as const };
}

export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await getSessionFromCookies();

    if (!session) return unauthorized();
    if (session.role !== "CUSTOMER") return forbidden();

    const { partnerId } = await params;

    await connectDB();

    const valid = await validatePartner(partnerId);
    if (!valid.ok) return valid.response;

    const customerId = new mongoose.Types.ObjectId(session.uid);
    const partnerObjectId = new mongoose.Types.ObjectId(partnerId);

    const existing = await FavoritePartner.findOne(
      {
        customerId,
        partnerId: partnerObjectId,
      },
      {
        _id: 1,
        status: 1,
      }
    ).lean();

    // 이미 레코드가 있으면 likedByCustomer만 true로 설정 (status 변경 없음)
    // 없으면 LIKED 레코드 신규 생성
    await FavoritePartner.updateOne(
      {
        customerId,
        partnerId: partnerObjectId,
      },
      {
        $set: { likedByCustomer: true },
        $setOnInsert: {
          customerId,
          partnerId: partnerObjectId,
          status: "LIKED",
          appliedAt: null,
        },
      },
      {
        upsert: true,
      }
    );

    return NextResponse.json(
      {
        ok: true,
        isFavorite: true,
        status: existing?.status ?? "LIKED",
        message: "관심업체에 저장되었습니다.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[CUSTOMER_FAVORITE_POST_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "관심업체 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getSessionFromCookies();

    if (!session) return unauthorized();
    if (session.role !== "CUSTOMER") return forbidden();

    const { partnerId } = await params;

    if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
      return badRequest("유효한 partnerId가 필요합니다.");
    }

    await connectDB();

    const customerId = new mongoose.Types.ObjectId(session.uid);
    const partnerObjectId = new mongoose.Types.ObjectId(partnerId);

    const existing = await FavoritePartner.findOne(
      { customerId, partnerId: partnerObjectId },
      { status: 1 }
    ).lean();

    if (existing && (existing as any).status === "APPLIED") {
      // 신청 기록이 있으면 레코드 유지, 찜 표시만 해제
      await FavoritePartner.updateOne(
        { customerId, partnerId: partnerObjectId },
        { $set: { likedByCustomer: false } }
      );
    } else {
      // 찜만 한 경우 레코드 삭제
      await FavoritePartner.findOneAndDelete({ customerId, partnerId: partnerObjectId });
    }

    return NextResponse.json(
      {
        ok: true,
        isFavorite: false,
        message: "관심업체가 해제되었습니다.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[CUSTOMER_FAVORITE_DELETE_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "관심업체 해제에 실패했습니다." },
      { status: 500 }
    );
  }
}