// src/services/wallet.ts
// =======================================================
// Wallet 서비스
// -------------------------------------------------------
// - 기존 Ledger 합산값으로 Wallet 초기화 가능
// - 차감은 balance >= amount 조건으로 원자 처리
// - 적립은 $inc로 원자 처리
// - 목록 조회용 잔액 map 제공
// =======================================================

import mongoose from "mongoose";
import { Wallet } from "@/models/Wallet";
import { Ledger } from "@/models/Ledger";
import type { WalletLeanDoc, WalletResult, MongoWriteError } from "@/types/wallet";

async function getLedgerBalanceSnapshot(
  accountId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<number> {
  const agg = Ledger.aggregate([
    { $match: { accountId } },
    {
      $group: {
        _id: "$accountId",
        balance: { $sum: "$amount" },
      },
    },
  ]);

  if (session) agg.session(session);

  const rows = await agg;
  return Number(rows?.[0]?.balance ?? 0);
}

export async function ensureWallet(
  accountId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
) {
  let wallet = await Wallet.findOne({ accountId }, null, { session });

  if (wallet) return wallet;

  const snapshotBalance = await getLedgerBalanceSnapshot(accountId, session);

  try {
    wallet = await Wallet.create(
      [
        {
          accountId,
          balance: snapshotBalance,
        },
      ],
      { session }
    ).then((rows) => rows[0]);

    return wallet;
  } catch (error: unknown) {
    const mongoErr = error as MongoWriteError;
    if (mongoErr?.code === 11000) {
      const existing = await Wallet.findOne({ accountId }, null, { session });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function getWalletBalance(
  accountId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<number> {
  const wallet = await ensureWallet(accountId, session);
  return Number(wallet.balance ?? 0);
}

export async function getWalletBalancesMap(
  accountIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
  const uniqueIds = Array.from(
    new Set(accountIds.map((id) => String(id)))
  ).map((id) => new mongoose.Types.ObjectId(id));

  if (uniqueIds.length === 0) {
    return new Map<string, number>();
  }

  const existing = await Wallet.find(
    { accountId: { $in: uniqueIds } },
    { accountId: 1, balance: 1 }
  ).lean();

  const existingMap = new Map<string, number>();
  for (const row of existing as WalletLeanDoc[]) {
    existingMap.set(String(row.accountId), Number(row.balance ?? 0));
  }

  const missingIds = uniqueIds.filter((id) => !existingMap.has(String(id)));

  if (missingIds.length > 0) {
    // 누락된 지갑의 원장 잔액을 한 번에 집계 (N+1 방지)
    const snapshots = await Ledger.aggregate([
      { $match: { accountId: { $in: missingIds } } },
      { $group: { _id: "$accountId", balance: { $sum: "$amount" } } },
    ]);
    const snapshotMap = new Map<string, number>();
    for (const row of snapshots) {
      snapshotMap.set(String(row._id), Number(row.balance ?? 0));
    }

    // 배치 삽입 (중복 키 에러 무시)
    const walletDocs = missingIds.map((accountId) => ({
      accountId,
      balance: snapshotMap.get(String(accountId)) ?? 0,
    }));
    await Wallet.insertMany(walletDocs, { ordered: false }).catch((err: unknown) => {
      const mongoErr = err as MongoWriteError;
      // 동시 생성 시 duplicate key 에러(11000)는 무시
      if (mongoErr?.code !== 11000 && mongoErr?.writeErrors?.every((e) => e?.code === 11000) === false) {
        throw err;
      }
    });

    const createdRows = await Wallet.find(
      { accountId: { $in: missingIds } },
      { accountId: 1, balance: 1 }
    ).lean();

    for (const row of createdRows as WalletLeanDoc[]) {
      existingMap.set(String(row.accountId), Number(row.balance ?? 0));
    }
  }

  return existingMap;
}

export async function creditWallet(
  accountId: mongoose.Types.ObjectId,
  amount: number,
  session?: mongoose.ClientSession
): Promise<WalletResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("creditWallet amount는 1 이상이어야 합니다.");
  }

  await ensureWallet(accountId, session);

  const updated = await Wallet.findOneAndUpdate(
    { accountId },
    { $inc: { balance: amount } },
    { new: true, session }
  );

  if (!updated) {
    throw new Error("지갑 적립 처리에 실패했습니다.");
  }

  return {
    balanceAfter: Number(updated.balance ?? 0),
    balanceBefore: Number(updated.balance ?? 0) - amount,
  };
}

export async function debitWallet(
  accountId: mongoose.Types.ObjectId,
  amount: number,
  session?: mongoose.ClientSession
): Promise<WalletResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("debitWallet amount는 1 이상이어야 합니다.");
  }

  await ensureWallet(accountId, session);

  const updated = await Wallet.findOneAndUpdate(
    {
      accountId,
      balance: { $gte: amount },
    },
    {
      $inc: { balance: -amount },
    },
    {
      new: true,
      session,
    }
  );

  if (!updated) {
    const current = await Wallet.findOne({ accountId }, null, { session });
    const currentBalance = Number(current?.balance ?? 0);
    throw new Error(`잔액 부족: 현재 ${currentBalance}P, 요청 ${amount}P`);
  }

  return {
    balanceAfter: Number(updated.balance ?? 0),
    balanceBefore: Number(updated.balance ?? 0) + amount,
  };
}