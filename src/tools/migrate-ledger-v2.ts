// src/tools/migrate-ledger-v2.ts
// =======================================================
// Ledger V2 마이그레이션 스크립트
// -------------------------------------------------------
// 1) 모든 Ledger 문서에 accountId 채우기 (accountId = userId)
// 2) IssueRequest / UseRequest의 ledgerId를 기반으로:
//    - requestedById / counterpartyId / approvedById / refType / refId 채우기
// =======================================================

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Ledger } from "@/models/Ledger";
import { IssueRequest } from "@/models/IssueRequest";
import { UseRequest } from "@/models/UseRequest";

function oid(v: any) {
  if (!v) return null;
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
}

async function fillAccountId() {
  const cursor = Ledger.find({
    accountId: { $exists: false },
    userId: { $ne: null },
  }).cursor();

  let n = 0;
  for await (const doc of cursor as any) {
    await Ledger.updateOne(
      { _id: doc._id },
      { $set: { accountId: doc.userId } }
    );
    n++;
    if (n % 500 === 0) console.log(`[1] fillAccountId... ${n}`);
  }
  console.log(`[1] fillAccountId DONE: ${n}`);
}

async function patchFromIssueRequests() {
  const cursor = IssueRequest.find({ ledgerId: { $ne: null } }).cursor();

  let n = 0;
  for await (const r of cursor as any) {
    const ledgerId = oid(r.ledgerId);
    if (!ledgerId) continue;

    const requesterId = oid(r.requesterId);
    const approvedById = oid(r.adminId);
    const accountId = oid(r.userId);

    const $set: any = {
      refType: "IssueRequest",
      refId: r._id,
    };

    if (accountId) $set.accountId = accountId;
    if (accountId) $set.userId = accountId;

    if (requesterId) {
      $set.requestedById = requesterId;
      $set.counterpartyId = requesterId;
    }

    if (approvedById) {
      $set.approvedById = approvedById;
    }

    await Ledger.updateOne({ _id: ledgerId }, { $set });
    n++;
    if (n % 500 === 0) console.log(`[2] patchFromIssueRequests... ${n}`);
  }
  console.log(`[2] patchFromIssueRequests DONE: ${n}`);
}

async function patchFromUseRequests() {
  const cursor = UseRequest.find({ ledgerId: { $ne: null } }).cursor();

  let n = 0;
  for await (const r of cursor as any) {
    const ledgerId = oid(r.ledgerId);
    if (!ledgerId) continue;

    const partnerId = oid(r.partnerId);
    const approvedById = oid(r.adminId);
    const accountId = oid(r.userId);

    const $set: any = {
      refType: "UseRequest",
      refId: r._id,
    };

    if (accountId) $set.accountId = accountId;
    if (accountId) $set.userId = accountId;

    if (partnerId) {
      $set.requestedById = partnerId;
      $set.counterpartyId = partnerId;
    }

    if (approvedById) {
      $set.approvedById = approvedById;
    }

    await Ledger.updateOne({ _id: ledgerId }, { $set });
    n++;
    if (n % 500 === 0) console.log(`[3] patchFromUseRequests... ${n}`);
  }
  console.log(`[3] patchFromUseRequests DONE: ${n}`);
}

async function main() {
  await connectDB();

  console.log("=== Ledger V2 migration start ===");
  await fillAccountId();
  await patchFromIssueRequests();
  await patchFromUseRequests();
  console.log("=== Ledger V2 migration done ===");

  await mongoose.connection.close();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});