import { Schema, models, model, Types } from "mongoose";

const PartnerStaffSchema = new Schema(
  {
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    partnerId: {
      type: Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// 조직 내 코드 중복 방지
PartnerStaffSchema.index({ organizationId: 1, code: 1 }, { unique: true });
PartnerStaffSchema.index({ organizationId: 1, partnerId: 1 });

export const PartnerStaff = models.PartnerStaff || model("PartnerStaff", PartnerStaffSchema);
