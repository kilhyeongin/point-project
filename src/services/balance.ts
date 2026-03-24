// src/services/balance.ts
// =======================================================
// 현재 잔액 조회 유틸
// -------------------------------------------------------
// - Wallet.balance를 기준으로 조회
// - Wallet이 없으면 기존 Ledger 합산값으로 자동 초기화
// =======================================================

import mongoose from "mongoose";
import { getWalletBalance } from "@/services/wallet";

export async function getAccountBalance(
  accountId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<number> {
  return getWalletBalance(accountId, session);
}