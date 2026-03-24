import type { Types } from "mongoose";
import type { UserRole } from "./user";

export type LedgerEntryType = "TOPUP" | "ISSUE" | "USE" | "ADJUST";
export type LedgerRefType =
  | "TOPUP_REQUEST"
  | "ISSUE_REQUEST"
  | "USE_REQUEST"
  | "USE_DIRECT"
  | "ADJUST"
  | null;

export type LedgerActorLean = {
  _id: Types.ObjectId;
  username: string;
  name: string;
  role: UserRole;
};

export type LedgerLeanDoc = {
  _id: Types.ObjectId;
  accountId: LedgerActorLean | Types.ObjectId | null;
  userId: LedgerActorLean | Types.ObjectId | null;
  actorId: LedgerActorLean | Types.ObjectId | null;
  counterpartyId: Types.ObjectId | null;
  type: LedgerEntryType;
  amount: number;
  refType: LedgerRefType;
  refId: Types.ObjectId | null;
  note: string;
  createdAt: Date;
};

export type LedgerFilter = {
  type?: LedgerEntryType | { $in: LedgerEntryType[] };
  accountId?: Types.ObjectId | { $in: Types.ObjectId[] };
  counterpartyId?: Types.ObjectId;
  createdAt?: { $gte?: Date; $lte?: Date };
};
