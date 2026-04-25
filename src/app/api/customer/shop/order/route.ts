import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { ShopProduct } from "@/models/ShopProduct";
import { ShopOrder } from "@/models/ShopOrder";
import { Ledger } from "@/models/Ledger";
import { debitWallet } from "@/services/wallet";
import { sendSms, buildGiftCardSmsText } from "@/lib/sms";
import { User } from "@/models/User";

// 스마트콘 API Mock — API 키 발급 후 실제 구현으로 교체
async function callSmartconAPI(params: {
  productCode: string;
  orderId: string;
  quantity: number;
}): Promise<{ pinNumber: string; pinUrl: string; smartconOrderId: string }> {
  // TODO: 실제 스마트콘 API 연동
  // const apiKey = process.env.SMARTCON_API_KEY;
  // const res = await fetch("https://api.smartcon.co.kr/v1/order", { ... });

  // Mock 응답
  return {
    pinNumber: `MOCK-${Date.now()}-${params.orderId.slice(-6)}`,
    pinUrl: "",
    smartconOrderId: `SC-${Date.now()}`,
  };
}

export async function POST(req: NextRequest) {
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
    const productId = String(body?.productId ?? "").trim();
    const idempotencyKey = String(body?.idempotencyKey ?? "").trim();

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return NextResponse.json(
        { ok: false, error: "잘못된 상품 ID입니다." },
        { status: 400 }
      );
    }

    if (!idempotencyKey || idempotencyKey.length < 10) {
      return NextResponse.json(
        { ok: false, error: "중복 방지 키가 필요합니다." },
        { status: 400 }
      );
    }

    await connectDB();

    const orgId = session.orgId ?? "4nwn";

    // 중복 주문 방지: orgId + customerId 스코프로 조회 (타 조직/유저의 키와 충돌 방지)
    const customerId = new mongoose.Types.ObjectId(session.uid);
    const existing = await ShopOrder.findOne({ idempotencyKey, organizationId: orgId, customerId }).lean();
    if (existing) {
      const existingOrder = existing as any;
      if (existingOrder.status === "COMPLETED") {
        return NextResponse.json({
          ok: true,
          orderId: String(existingOrder._id),
          pinNumber: String(existingOrder.pinNumber ?? ""),
          pinUrl: String(existingOrder.pinUrl ?? ""),
          alreadyProcessed: true,
        });
      }
      return NextResponse.json(
        { ok: false, error: "이미 처리 중인 주문입니다." },
        { status: 409 }
      );
    }

    // 상품 조회
    const product = await ShopProduct.findOne({
      _id: productId,
      organizationId: orgId,
      isActive: true,
    }).lean();

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "존재하지 않거나 구매할 수 없는 상품입니다." },
        { status: 404 }
      );
    }

    const productDoc = product as any;
    const pointCost = Number(productDoc.pointCost);

    // MongoDB 트랜잭션으로 포인트 차감 + 원장 기록 + 주문 생성 원자 처리
    const dbSession = await mongoose.startSession();
    let order: any;
    let ledger: any;

    try {
      await dbSession.withTransaction(async () => {
        // 1. 주문 생성 (PENDING)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Math.max(1, Number(productDoc.expirationDays ?? 90)));

        const [newOrder] = await ShopOrder.create(
          [
            {
              organizationId: orgId,
              customerId,
              productId: new mongoose.Types.ObjectId(productId),
              productSnapshot: {
                name: productDoc.name,
                brand: productDoc.brand,
                pointCost,
                expirationDays: productDoc.expirationDays ?? 90,
              },
              pointsSpent: pointCost,
              idempotencyKey,
              expiresAt,
              status: "PENDING",
            },
          ],
          { session: dbSession }
        );
        order = newOrder;

        // 2. 포인트 차감 (잔액 부족 시 여기서 throw → 트랜잭션 롤백)
        await debitWallet(customerId, pointCost, dbSession);

        // 3. Ledger 기록
        const [newLedger] = await Ledger.create(
          [
            {
              organizationId: orgId,
              accountId: customerId,
              userId: customerId,
              type: "USE",
              amount: -pointCost,
              refType: "ShopOrder",
              refId: newOrder._id,
              note: `상품몰 구매: ${productDoc.name}`,
            },
          ],
          { session: dbSession }
        );
        ledger = newLedger;

        // 4. 주문 상태 POINT_DEDUCTED로 업데이트
        await ShopOrder.updateOne(
          { _id: newOrder._id },
          { $set: { status: "POINT_DEDUCTED", ledgerId: newLedger._id } },
          { session: dbSession }
        );
      });
    } finally {
      await dbSession.endSession();
    }

    // 5. 스마트콘 API 호출 (트랜잭션 밖 — 포인트는 이미 차감됨)
    await ShopOrder.updateOne(
      { _id: order._id },
      { $set: { status: "SMARTCON_CALLED", smartconLastTriedAt: new Date() } }
    );

    let pinNumber = "";
    let pinUrl = "";
    let smartconOrderId = "";

    try {
      const result = await callSmartconAPI({
        productCode: String(productDoc.smartconProductCode ?? ""),
        orderId: String(order._id),
        quantity: 1,
      });
      pinNumber = result.pinNumber;
      pinUrl = result.pinUrl;
      smartconOrderId = result.smartconOrderId;

      await ShopOrder.updateOne(
        { _id: order._id },
        {
          $set: {
            status: "COMPLETED",
            pinNumber,
            pinUrl,
            smartconOrderId,
          },
        }
      );

      // SMS 발송 (실패해도 구매는 유지)
      try {
        const user = await User.findById(customerId, {
          "customerProfile.phone": 1,
        }).lean();
        const phone = String((user as any)?.customerProfile?.phone ?? "").trim();

        if (phone) {
          const smsText = buildGiftCardSmsText({
            productName: productDoc.name,
            pinNumber,
            expiresAt: order.expiresAt ?? null,
          });
          await sendSms(phone, smsText);
        }
      } catch (smsError) {
        console.error("[SHOP_SMS_ERROR]", smsError);
      }
    } catch (smartconError) {
      console.error("[SHOP_SMARTCON_ERROR]", smartconError);

      await ShopOrder.updateOne(
        { _id: order._id },
        {
          $set: {
            status: "FAILED",
            failReason: "스마트콘 API 호출 실패",
            smartconRetryCount: 1,
          },
        }
      );

      // 실패 시 자동 환불
      try {
        const refundSession = await mongoose.startSession();
        try {
          await refundSession.withTransaction(async () => {
            const { creditWallet } = await import("@/services/wallet");
            await creditWallet(customerId, pointCost, refundSession);

            const [refundLedger] = await Ledger.create(
              [
                {
                  organizationId: orgId,
                  accountId: customerId,
                  userId: customerId,
                  type: "ADJUST",
                  amount: pointCost,
                  refType: "ShopOrder",
                  refId: order._id,
                  note: `상품몰 구매 실패 환불: ${productDoc.name}`,
                },
              ],
              { session: refundSession }
            );

            await ShopOrder.updateOne(
              { _id: order._id },
              {
                $set: {
                  status: "REFUNDED",
                  refundLedgerId: refundLedger._id,
                  refundedAt: new Date(),
                },
              },
              { session: refundSession }
            );
          });
        } finally {
          await refundSession.endSession();
        }
      } catch (refundError) {
        console.error("[SHOP_REFUND_ERROR]", refundError);
      }

      return NextResponse.json(
        { ok: false, error: "상품권 발송에 실패했습니다. 포인트가 환불됩니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: String(order._id),
      pinNumber,
      pinUrl,
      expiresAt: order.expiresAt,
    });
  } catch (error: any) {
    if (String(error?.message ?? "").includes("잔액 부족")) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }
    console.error("[SHOP_ORDER_POST_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "구매 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
