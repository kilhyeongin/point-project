// src/models/IssueRequest.ts
// =======================================================
// 포인트 지급 요청(승인형) 모델
// -------------------------------------------------------
// ✔ PARTNER(요청자)가 고객에게 "지급 요청"을 생성(PENDING)
// ✔ ADMIN이 승인/거절 처리
// ✔ 승인(APPROVED)될 때 Ledger에 ISSUE(+amount) 기록
// ✔ Ledger 생성은 오직 ADMIN 승인 시에만!
// =======================================================

import mongoose, { Schema, model, models } from "mongoose";

export type IssueRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

const IssueRequestSchema = new Schema(
  {
    // 지급 받는 고객
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 지급 요청자 (PARTNER)
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 승인/거절 처리한 총괄관리자(ADMIN)
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // 요청 금액 (항상 양수로 저장)
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

    // 메모(예: 지급 사유, 계약/주문번호 등)
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

export const IssueRequest =
  models.IssueRequest || model("IssueRequest", IssueRequestSchema);