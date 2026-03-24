import { Schema, models, model } from "mongoose";

const PartnerCategorySchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      match: /^[A-Z0-9_-]+$/,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVisibleToPartner: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVisibleToCustomer: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    createdBy: {
      type: String,
      default: "",
      trim: true,
    },
    updatedBy: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

PartnerCategorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });
PartnerCategorySchema.index({ isVisibleToPartner: 1, isActive: 1, sortOrder: 1 });
PartnerCategorySchema.index({ isVisibleToCustomer: 1, isActive: 1, sortOrder: 1 });

export const PartnerCategoryMaster =
  models.PartnerCategoryMaster || model("PartnerCategoryMaster", PartnerCategorySchema);