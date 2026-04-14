// src/models/UseRequest.ts
// =======================================================
// 포인트 사용 요청(승인형) 모델
// -------------------------------------------------------
// ✔ PARTNER가 고객 포인트 사용 요청을 생성(PENDING)
// ✔ ADMIN이 승인/거절 처리
// ✔ 승인(APPROVED)될 때 Ledger에 USE(-amount) 기록
// =======================================================

import mongoose, { Schema, model, models } from "mongoose";

export type UseRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

const UseRequestSchema = new Schema(
  {
    organizationId: {
      type: String,
      default: "4nwn",
      index: true,
    },

    // 포인트를 사용하는 고객
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 요청을 생성한 제휴사
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 승인/거절을 처리한 총괄관리자(ADMIN)
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // 사용 요청 포인트 (항상 양수로 저장)
    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    // 상태
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    // 메모(예: 결제내용, 주문번호, 사용처 등)
    note: {
      type: String,
      default: "",
    },

    // 승인/거절 처리 시간
    decidedAt: {
      type: Date,
      default: null,
    },

    // 승인 시 생성된 Ledger 트랜잭션 id (중복 승인 방지용)
    ledgerId: {
      type: Schema.Types.ObjectId,
      ref: "Ledger",
      default: null,
    },
  },
  { timestamps: true }
);

export const UseRequest =
  models.UseRequest || model("UseRequest", UseRequestSchema);