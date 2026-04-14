// src/models/Wallet.ts
// =======================================================
// Wallet: 계정별 현재 잔액 스냅샷
// -------------------------------------------------------
// - accountId 1개당 Wallet 1개
// - 실제 차감/적립은 Wallet.balance를 원자적으로 갱신
// - Ledger는 이력 기록용
// =======================================================

import { Schema, model, models } from "mongoose";

const WalletSchema = new Schema(
  {
    organizationId: {
      type: String,
      default: "4nwn",
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Wallet = models.Wallet || model("Wallet", WalletSchema);

export default Wallet;