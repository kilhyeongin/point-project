// src/models/SettlementPeriod.ts
// =======================================================
// 정산 기간(마감) 모델
// -------------------------------------------------------
// ✔ periodKey(YYYY-MM) 단위로 정산을 "마감(LOCK)" 한다.
// ✔ 마감된 기간은 숫자를 고정해두고, 이후 변경은 ADJUST로 처리하는 방식 권장.
// =======================================================

import mongoose, { Schema, model, models } from "mongoose";

export type SettlementPeriodStatus = "OPEN" | "CLOSED" | "PAID";

const SettlementPeriodSchema = new Schema(
  {
    organizationId: { type: String, default: "4nwn", index: true },

    // 예: "2026-03"
    periodKey: { type: String, required: true, index: true },

    // 정산 범위(UTC 기준 저장 권장)
    from: { type: Date, required: true },
    to: { type: Date, required: true },

    status: {
      type: String,
      enum: ["OPEN", "CLOSED", "PAID"],
      default: "OPEN",
      index: true,
    },

    // 마감(LOCK) 정보
    closedAt: { type: Date, default: null },
    closedById: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    // 지급(PAID) 정보
    paidAt: { type: Date, default: null },
    paidById: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    // 요약(대시보드용)
    totalCounterparties: { type: Number, default: 0 },
    totalUseCount: { type: Number, default: 0 },
    totalUsedPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// organizationId + periodKey 복합 유니크
SettlementPeriodSchema.index({ organizationId: 1, periodKey: 1 }, { unique: true });

export const SettlementPeriod =
  models.SettlementPeriod || model("SettlementPeriod", SettlementPeriodSchema);