import { Schema, model, models } from "mongoose";

const PointSettlementPaymentSchema = new Schema(
  {
    organizationId: { type: String, default: "4nwn", index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partnerName: { type: String, default: "", trim: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    partnerLedgerId: { type: Schema.Types.ObjectId, default: null },
    adminLedgerId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, versionKey: false }
);

PointSettlementPaymentSchema.index({ organizationId: 1, partnerId: 1, year: 1, month: 1 });
// 동시 중복 신청 방지: 파트너당 PENDING 정산은 1건만
PointSettlementPaymentSchema.index(
  { organizationId: 1, partnerId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" }, name: "unique_pending_settlement_per_partner" }
);

export const PointSettlementPayment =
  models.PointSettlementPayment ||
  model("PointSettlementPayment", PointSettlementPaymentSchema);

export default PointSettlementPayment;
