// src/models/Ledger.ts
import mongoose, { Schema, model, models } from "mongoose";

const LedgerSchema = new Schema(
  {
    // 실제 잔액 주인(지갑 소유자)
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 직접 대상 사용자 (예: 고객 적립행에서 고객)
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // 실행자
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // 정산 상대방(제휴사)
    counterpartyId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // 거래 유형
    type: {
      type: String,
      enum: ["TOPUP", "ISSUE", "USE", "ADJUST"],
      required: true,
      index: true,
    },

    // +/- 금액
    amount: {
      type: Number,
      required: true,
    },

    // 참조 타입/ID
    refType: {
      type: String,
      default: null,
      index: true,
    },

    refId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
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

LedgerSchema.index({ accountId: 1, createdAt: -1 });
LedgerSchema.index({ type: 1, createdAt: -1 });
LedgerSchema.index({ counterpartyId: 1, createdAt: -1 });
// 사용자 내역 조회용 복합 인덱스
LedgerSchema.index({ userId: 1, createdAt: -1 });
// 관리자 실행자 조회용
LedgerSchema.index({ actorId: 1, createdAt: -1 });
// 정산 집계용: type + createdAt
LedgerSchema.index({ type: 1, counterpartyId: 1, createdAt: -1 });

export const Ledger =
  models.Ledger || model("Ledger", LedgerSchema);

export default Ledger;