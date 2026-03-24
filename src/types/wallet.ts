import type { Types } from "mongoose";

export type WalletLeanDoc = {
  _id: Types.ObjectId;
  accountId: Types.ObjectId;
  balance: number;
};

export type WalletResult = {
  balanceBefore: number;
  balanceAfter: number;
};

// MongoDB 에러 타입 가드용
export type MongoWriteError = {
  code?: number;
  writeErrors?: Array<{ code?: number }>;
};

export function isMongoWriteError(err: unknown): err is MongoWriteError {
  return typeof err === "object" && err !== null && "code" in err;
}
