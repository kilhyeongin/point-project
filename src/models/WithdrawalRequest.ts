import { Schema, model, models } from "mongoose";

const WithdrawalRequestSchema = new Schema(
  {
    organizationId: { type: String, default: "4nwn", index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partnerName: { type: String, default: "", trim: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    adminNote: { type: String, default: "", trim: true },
    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

WithdrawalRequestSchema.index({ organizationId: 1, partnerId: 1, status: 1 });
// Prevents double-submission race: only one PENDING request per partner per org
WithdrawalRequestSchema.index(
  { organizationId: 1, partnerId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" }, name: "unique_pending_per_partner" }
);

export const WithdrawalRequest =
  models.WithdrawalRequest || model("WithdrawalRequest", WithdrawalRequestSchema);

export default WithdrawalRequest;
