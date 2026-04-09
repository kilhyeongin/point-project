import type { Types } from "mongoose";

export type UserRole = "ADMIN" | "HOST" | "PARTNER" | "CUSTOMER";
export type UserStatus = "ACTIVE" | "PENDING" | "BLOCKED";

export type CustomerProfileLean = {
  phone: string;
  address: string;
  detailAddress: string;
  onboardingCompleted: boolean;
  interests: string[];
};

export type PartnerProfileLean = {
  businessName: string;
  businessNumber: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  detailAddress: string;
  category: string;
  categories: string[];
  intro: string;
  benefitText: string;
  kakaoChannelUrl: string;
  applyUrl: string;
  phone: string;
  coverImageUrl: string;
  isPublished: boolean;
  scheduleEnabled: boolean;
  operatingDays: number[];
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  maxPerSlot: number;
  advanceDays: number;
  breakStart: string;
  breakEnd: string;
  closedOnHolidays: boolean;
  blockedDates: string[];
};

export type UserLeanDoc = {
  _id: Types.ObjectId;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  pointBalance: number;
  createdAt: Date;
  updatedAt: Date;
  customerProfile?: CustomerProfileLean;
  partnerProfile?: PartnerProfileLean;
};

// API 응답용 DTO
export type UserBriefDto = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
};

export type AccountItemDto = UserBriefDto & {
  status: UserStatus;
  balance: number;
};

// MongoDB 쿼리 필터 타입
export type UserFilter = {
  organizationId?: string;
  role?: UserRole | { $in: UserRole[] };
  status?: UserStatus | { $in: UserStatus[] };
  $or?: Array<Record<string, unknown>>;
};
