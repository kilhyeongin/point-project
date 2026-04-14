import { Schema, models, model } from "mongoose";

export type UserRole = "ADMIN" | "HOST" | "PARTNER" | "CUSTOMER";
export type UserStatus = "ACTIVE" | "PENDING" | "BLOCKED";

const CustomerProfileSchema = new Schema(
  {
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    detailAddress: {
      type: String,
      default: "",
      trim: true,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    interests: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const PartnerProfileSchema = new Schema(
  {
    businessName: {
      type: String,
      default: "",
      trim: true,
    },
    businessNumber: {
      type: String,
      default: "",
      trim: true,
    },
    contactName: {
      type: String,
      default: "",
      trim: true,
    },
    contactPhone: {
      type: String,
      default: "",
      trim: true,
    },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    detailAddress: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    categories: {
      type: [String],
      default: [],
    },
    intro: {
      type: String,
      default: "",
      trim: true,
    },
    benefitText: {
      type: String,
      default: "",
      trim: true,
    },
    kakaoChannelUrl: {
      type: String,
      default: "",
      trim: true,
    },
    applyUrl: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    coverImageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ── 예약 스케줄 설정 ──────────────────────────────
    scheduleEnabled: {
      type: Boolean,
      default: true,
    },
    // 운영 요일 (0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
    operatingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5],
    },
    openTime: {
      type: String,
      default: "09:00",
    },
    closeTime: {
      type: String,
      default: "18:00",
    },
    slotMinutes: {
      type: Number,
      default: 30,
    },
    maxPerSlot: {
      type: Number,
      default: 1,
    },
    advanceDays: {
      type: Number,
      default: 30,
    },
    // 휴무시간 (점심 등) — 빈 문자열이면 미사용
    breakStart: {
      type: String,
      default: "12:00",
    },
    breakEnd: {
      type: String,
      default: "13:00",
    },
    // 공휴일 휴무 여부 (true = 공휴일에 예약 불가)
    closedOnHolidays: {
      type: Boolean,
      default: true,
    },
    // 특정 휴무일 (YYYY-MM-DD 배열)
    blockedDates: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const SocialAccountSchema = new Schema(
  {
    provider: { type: String, required: true }, // "naver" | "kakao"
    providerId: { type: String, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    organizationId: {
      type: String,
      default: "4nwn",
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      default: "",
    },
    socialAccounts: {
      type: [SocialAccountSchema],
      default: [],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["ADMIN", "HOST", "PARTNER", "CUSTOMER"],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "PENDING", "BLOCKED"],
      default: "ACTIVE",
      index: true,
    },
    pointBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    customerProfile: {
      type: CustomerProfileSchema,
      default: () => ({}),
    },
    partnerProfile: {
      type: PartnerProfileSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ organizationId: 1, role: 1, status: 1 });
UserSchema.index({ organizationId: 1, role: 1, "partnerProfile.isPublished": 1 });
UserSchema.index({ organizationId: 1, role: 1, "partnerProfile.categories": 1 });

export const User = models.User || model("User", UserSchema);