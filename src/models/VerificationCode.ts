import { Schema, models, model } from "mongoose";

const VerificationCodeSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL: MongoDB가 expiresAt 시점에 자동 삭제
    },
  },
  { timestamps: true }
);

export const VerificationCode =
  models.VerificationCode || model("VerificationCode", VerificationCodeSchema);
