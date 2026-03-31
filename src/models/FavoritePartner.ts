// src/models/FavoritePartner.ts
// =======================================================
// CUSTOMER ↔ PARTNER 관계 모델
// -------------------------------------------------------
// - 고객이 제휴사를 찜하면 LIKED
// - 고객이 제휴사에 신청하면 APPLIED
// - customerId + partnerId 복합 유니크
// =======================================================

import mongoose, { Schema, model, models } from "mongoose";

export type FavoritePartnerStatus = "LIKED" | "APPLIED";
export type AppointmentHistoryAction = "APPLIED" | "CANCELLED" | "CHANGED";
export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "NOSHOW" | "CANCELLED";

export interface IAppointmentHistory {
  action: AppointmentHistoryAction;
  appointmentAt: Date;
  appointmentNote: string;
  previousAppointmentAt?: Date | null;
  createdAt: Date;
}

export interface IFavoritePartner {
  customerId: mongoose.Types.ObjectId;
  partnerId: mongoose.Types.ObjectId;
  status: FavoritePartnerStatus;
  likedByCustomer: boolean;
  createdAt: Date;
  updatedAt: Date;
  appliedAt?: Date | null;
  appointmentAt?: Date | null;
  appointmentNote?: string;
  appointmentStatus?: AppointmentStatus;
  appointmentHistory?: IAppointmentHistory[];
}

const FavoritePartnerSchema = new Schema<IFavoritePartner>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["LIKED", "APPLIED"],
      default: "LIKED",
      required: true,
      index: true,
    },

    // 고객이 명시적으로 찜(별)을 눌렀는지 여부.
    // status(LIKED/APPLIED)와 독립적으로 관리되어
    // 신청 후 찜 해제 시 신청 기록이 사라지지 않도록 한다.
    likedByCustomer: {
      type: Boolean,
      default: true, // 기존 데이터 하위호환: 레코드가 있으면 찜한 것으로 간주
      index: true,
    },

    appliedAt: {
      type: Date,
      default: null,
    },

    appointmentAt: {
      type: Date,
      default: null,
    },
    appointmentNote: {
      type: String,
      default: "",
      trim: true,
    },
    appointmentStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "COMPLETED", "NOSHOW", "CANCELLED"],
      default: "PENDING",
    },

    appointmentHistory: {
      type: [
        new Schema(
          {
            action: {
              type: String,
              enum: ["APPLIED", "CANCELLED", "CHANGED"],
              required: true,
            },
            appointmentAt: { type: Date, required: true },
            appointmentNote: { type: String, default: "" },
            previousAppointmentAt: { type: Date, default: null },
          },
          { timestamps: { createdAt: true, updatedAt: false }, _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

FavoritePartnerSchema.index({ customerId: 1, partnerId: 1 }, { unique: true });
FavoritePartnerSchema.index({ partnerId: 1, status: 1, createdAt: -1 });
FavoritePartnerSchema.index({ customerId: 1, status: 1, createdAt: -1 });

export const FavoritePartner =
  models.FavoritePartner ||
  model<IFavoritePartner>("FavoritePartner", FavoritePartnerSchema);
