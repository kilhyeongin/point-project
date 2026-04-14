// src/models/AuditLog.ts
// 관리자 민감 작업 감사 로그
import { Schema, model, models } from "mongoose";

const AuditLogSchema = new Schema(
  {
    organizationId: { type: String, default: "4nwn", index: true },

    // 작업을 수행한 관리자 ID
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adminUsername: { type: String, required: true },

    // 작업 종류: TOPUP, ADJUST, PAYOUT, ROLE_CHANGE, STATUS_CHANGE
    action: { type: String, required: true, index: true },

    // 대상 사용자 ID (있는 경우)
    targetId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    targetUsername: { type: String, default: null },

    // 작업 상세 (amount, before/after 값 등)
    detail: { type: Schema.Types.Mixed, default: {} },

    // 요청 IP
    ip: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AuditLogSchema.index({ organizationId: 1, adminId: 1, createdAt: -1 });
AuditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });

export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);
export default AuditLog;
