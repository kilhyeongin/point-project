import { Schema, model, models } from "mongoose";

// 상태 흐름:
// PENDING → POINT_DEDUCTED → SMARTCON_CALLED → COMPLETED
//                          ↘ FAILED → REFUNDED
const ShopOrderSchema = new Schema(
  {
    organizationId: {
      type: String,
      default: "4nwn",
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "ShopProduct",
      required: true,
      index: true,
    },
    productSnapshot: {
      name: { type: String, required: true },
      brand: { type: String, required: true },
      pointCost: { type: Number, required: true },
      expirationDays: { type: Number, default: 90 },
    },
    pointsSpent: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: [
        "PENDING",          // 주문 생성
        "POINT_DEDUCTED",   // 포인트 차감 완료
        "SMARTCON_CALLED",  // 스마트콘 API 호출 중
        "COMPLETED",        // 발송 완료
        "FAILED",           // 실패 (환불 대기)
        "REFUNDED",         // 포인트 환불 완료
      ],
      default: "PENDING",
      index: true,
    },
    // 중복 구매 방지용 클라이언트 발급 키
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // 포인트 차감 Ledger 연결 (중복 처리 방지)
    ledgerId: {
      type: Schema.Types.ObjectId,
      ref: "Ledger",
      default: null,
    },
    // 환불 Ledger 연결
    refundLedgerId: {
      type: Schema.Types.ObjectId,
      ref: "Ledger",
      default: null,
    },
    // 스마트콘 API 응답값
    pinNumber: {
      type: String,
      default: "",
      trim: true,
    },
    pinUrl: {
      type: String,
      default: "",
      trim: true,
    },
    smartconOrderId: {
      type: String,
      default: "",
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    failReason: {
      type: String,
      default: "",
      trim: true,
    },
    // 스마트콘 재시도 횟수
    smartconRetryCount: {
      type: Number,
      default: 0,
    },
    smartconLastTriedAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ShopOrderSchema.index({ organizationId: 1, customerId: 1, createdAt: -1 });
ShopOrderSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
// 장애 복구 Cron용: FAILED 상태이면서 환불 안 된 주문 조회
ShopOrderSchema.index({ status: 1, createdAt: 1 });

export const ShopOrder =
  models.ShopOrder || model("ShopOrder", ShopOrderSchema);

export default ShopOrder;
