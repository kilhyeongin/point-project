// src/models/GeneralSettlement.ts
import { Schema, model, models } from "mongoose";

const RowSchema = new Schema(
  {
    cells: { type: [String], default: [] },
  },
  { _id: false }
);

const GeneralSettlementSchema = new Schema(
  {
    organizationId: {
      type: String,
      default: "4nwn",
      index: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    partnerName: {
      type: String,
      default: "",
      trim: true,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: Number,
      required: true,
    },
    periodStart: {
      type: String,
      default: "",
      trim: true,
    },
    periodEnd: {
      type: String,
      default: "",
      trim: true,
    },
    columns: {
      type: [String],
      default: ["예식일", "출발일", "손님 성함", "여행지", "정산", "비고"],
    },
    rows: {
      type: [RowSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "CONFIRMED"],
      default: "DRAFT",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

GeneralSettlementSchema.index({ organizationId: 1, partnerId: 1, year: 1, month: 1 });

export const GeneralSettlement =
  models.GeneralSettlement || model("GeneralSettlement", GeneralSettlementSchema);

export default GeneralSettlement;
