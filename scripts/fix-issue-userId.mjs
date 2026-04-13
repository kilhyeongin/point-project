// scripts/fix-issue-userId.mjs
// 마이그레이션: issue-requests로 생성된 ISSUE 차감행에서
// userId가 accountId(파트너 본인)로 잘못 저장된 것을 counterpartyId(고객)로 수정

import mongoose from "mongoose";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI 환경변수가 없습니다.");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log("MongoDB 연결됨");

const db = mongoose.connection.db;
const col = db.collection("ledgers");

// 대상 조건:
// - type = "ISSUE"
// - amount < 0  (차감 행)
// - userId = accountId  (버그: 파트너가 자기 자신을 userId로 설정)
// - counterpartyId != accountId  (정상 데이터와 구분)
const pipeline = [
  {
    $match: {
      type: "ISSUE",
      amount: { $lt: 0 },
      $expr: {
        $and: [
          { $eq: ["$userId", "$accountId"] },
          { $ne: ["$counterpartyId", "$accountId"] },
        ],
      },
    },
  },
];

const bad = await col.aggregate(pipeline).toArray();
console.log(`수정 대상 건수: ${bad.length}`);

if (bad.length === 0) {
  console.log("수정할 데이터가 없습니다.");
  await mongoose.disconnect();
  process.exit(0);
}

// 미리보기
bad.slice(0, 5).forEach((doc) => {
  console.log(`  _id=${doc._id}  accountId=${doc.accountId}  userId=${doc.userId}  counterpartyId=${doc.counterpartyId}  amount=${doc.amount}`);
});

// 실제 수정
const result = await col.updateMany(
  {
    type: "ISSUE",
    amount: { $lt: 0 },
    $expr: {
      $and: [
        { $eq: ["$userId", "$accountId"] },
        { $ne: ["$counterpartyId", "$accountId"] },
      ],
    },
  },
  [
    { $set: { userId: "$counterpartyId" } },
  ]
);

console.log(`수정 완료: ${result.modifiedCount}건`);
await mongoose.disconnect();
console.log("완료");
