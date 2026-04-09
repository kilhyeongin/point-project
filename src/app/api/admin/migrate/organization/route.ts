// src/app/api/admin/migrate/organization/route.ts
// 기존 데이터에 organizationId: "default" 일괄 설정
// ADMIN만 접근 가능, GET 요청으로 실행

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import mongoose from "mongoose";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  await connectDB();
  const db = mongoose.connection.db;

  if (!db) {
    return NextResponse.json({ ok: false, message: "DB 연결 실패" }, { status: 500 });
  }

  const filter = { organizationId: { $exists: false } };
  const update = { $set: { organizationId: "default" } };

  const collections = [
    "users",
    "ledgers",
    "wallets",
    "settlements",
    "favoritepartners",
    "issuerequests",
    "userequests",
    "topuprequests",
    "auditlogs",
    "settlementperiods",
    "partnercategorymasters",
  ];

  const results: Record<string, number> = {};

  for (const collectionName of collections) {
    try {
      const result = await db.collection(collectionName).updateMany(filter, update);
      results[collectionName] = result.modifiedCount;
    } catch (err) {
      results[collectionName] = -1;
      console.error(`[MIGRATE_ORG] ${collectionName} 오류:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "organizationId 마이그레이션 완료",
    results,
  });
}
