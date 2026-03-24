// src/lib/permission.ts
import mongoose from "mongoose";
import { FavoritePartner } from "@/models/FavoritePartner";

export async function validatePartnerCustomerRelation({
  partnerId,
  customerId,
}: {
  partnerId: string;
  customerId: string;
}) {
  if (
    !mongoose.Types.ObjectId.isValid(partnerId) ||
    !mongoose.Types.ObjectId.isValid(customerId)
  ) {
    return {
      ok: false,
      status: 400,
      message: "잘못된 ID입니다.",
    };
  }

  const relation = await FavoritePartner.findOne({
    partnerId: new mongoose.Types.ObjectId(partnerId),
    customerId: new mongoose.Types.ObjectId(customerId),
  }).lean();

  if (!relation) {
    return {
      ok: false,
      status: 403,
      message: "해당 고객과 연결된 이력이 없습니다.",
    };
  }

  if (relation.status !== "APPLIED") {
    return {
      ok: false,
      status: 403,
      message: "신청 고객만 가능합니다.",
    };
  }

  return { ok: true };
}