// src/models/PasswordResetToken.ts
import { Schema, models, model } from "mongoose";

const PasswordResetTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL: MongoDB가 expiresAt 시점에 자동 삭제
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const PasswordResetToken =
  models.PasswordResetToken ||
  model("PasswordResetToken", PasswordResetTokenSchema);
