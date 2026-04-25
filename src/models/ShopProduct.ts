import { Schema, model, models } from "mongoose";

const ShopProductSchema = new Schema(
  {
    organizationId: {
      type: String,
      default: "4nwn",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    pointCost: {
      type: Number,
      required: true,
      min: [1, "포인트는 1 이상이어야 합니다."],
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    // 스마트콘 상품 코드 (API 연동 시 사용)
    smartconProductCode: {
      type: String,
      default: "",
      trim: true,
    },
    expirationDays: {
      type: Number,
      default: 90,
      min: 1,
    },
    isActive: {
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
    },
    updatedBy: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ShopProductSchema.index({ organizationId: 1, isActive: 1, sortOrder: 1 });

export const ShopProduct =
  models.ShopProduct || model("ShopProduct", ShopProductSchema);

export default ShopProduct;
