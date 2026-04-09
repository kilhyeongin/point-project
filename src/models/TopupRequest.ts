import mongoose, { Schema, model, models } from "mongoose";

const TopupRequestSchema = new Schema(
  {
    organizationId: {
      type: String,
      default: "default",
      index: true,
    },

    accountId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    requestedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    approvedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    ledgerId: {
      type: Schema.Types.ObjectId,
      ref: "Ledger",
      default: null,
    },

    note: {
      type: String,
      default: "",
    },

    decidedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const TopupRequest =
  models.TopupRequest || model("TopupRequest", TopupRequestSchema);