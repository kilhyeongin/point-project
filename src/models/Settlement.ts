// src/models/Settlement.ts
import mongoose, { Schema, model, models } from "mongoose";

const CounterpartySnapshotSchema = new Schema(
  {
    id: { type: String, default: "" },
    username: { type: String, default: "" },
    name: { type: String, default: "" },
    role: { type: String, default: "" },
    status: { type: String, default: "" },
  },
  { _id: false }
);

const SettlementSchema = new Schema(
  {
    // 정산 기준 월
    periodKey: {
      type: String,
      required: true,
      index: true,
    },

    // 집계 기간
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },

    // 정산 대상 업체
    counterpartyId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 마감 시점 업체 정보 스냅샷
    counterpartySnapshot: {
      type: CounterpartySnapshotSchema,
      default: null,
    },

    // 집계값
    useCount: {
      type: Number,
      required: true,
      default: 0,
    },
    usedPoints: {
      type: Number,
      required: true,
      default: 0,
    },

    // 수수료
    // 저장은 decimal (예: 0.1 = 10%)
    feeRate: {
      type: Number,
      required: true,
      default: 0,
    },
    feeAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    // 지급 순액
    netPayable: {
      type: Number,
      required: true,
      default: 0,
    },

    // 마지막 사용 시각
    lastUsedAt: {
      type: Date,
      default: null,
    },

    // 상태
    // OPEN: 마감됨, 아직 미지급
    // PAID: 지급완료
    status: {
      type: String,
      enum: ["OPEN", "PAID"],
      required: true,
      default: "OPEN",
      index: true,
    },

    // 마감 시각
    closedAt: {
      type: Date,
      default: null,
    },

    // 지급 처리 정보
    paidAt: {
      type: Date,
      default: null,
    },
    payoutRef: {
      type: String,
      default: "",
      trim: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// 한 기간에 한 업체당 정산 라인 1개
SettlementSchema.index(
  { periodKey: 1, counterpartyId: 1 },
  { unique: true }
);

SettlementSchema.index({ periodKey: 1, status: 1 });
SettlementSchema.index({ counterpartyId: 1, status: 1 });

export const Settlement =
  models.Settlement || model("Settlement", SettlementSchema);

export default Settlement;