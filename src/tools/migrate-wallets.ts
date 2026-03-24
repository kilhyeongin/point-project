// src/tools/migrate-wallets.ts
// =======================================================
// 기존 Ledger 합산값을 Wallet으로 백필
// -------------------------------------------------------
// 실행 예시:
// npx tsx src/tools/migrate-wallets.ts
// =======================================================

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
import { Wallet } from "@/models/Wallet";

async function run() {
  await connectDB();

  const rows = await Ledger.aggregate([
    {
      $group: {
        _id: "$accountId",
        balance: { $sum: "$amount" },
      },
    },
  ]);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const accountId = row._id;
    const balance = Number(row.balance ?? 0);

    const existing = await Wallet.findOne({ accountId });

    if (!existing) {
      await Wallet.create({
        accountId,
        balance,
      });
      created += 1;
      continue;
    }

    if (Number(existing.balance ?? 0) !== balance) {
      existing.balance = balance;
      await existing.save();
      updated += 1;
    }
  }

  console.log("Wallet migration done");
  console.log({ created, updated, total: rows.length });

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});