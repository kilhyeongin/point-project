// src/lib/db.ts
// MongoDB 연결 유틸 (중복 연결 방지 + env 지연 로딩)

import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var mongooseConn: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

global.mongooseConn = global.mongooseConn || {
  conn: null,
  promise: null,
};

export async function connectDB() {
  // ✅ 여기서 MONGODB_URI 읽도록 변경
  const MONGODB_URI = process.env.MONGODB_URI as string;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI가 환경변수에 없습니다.");
  }

  if (global.mongooseConn.conn) return global.mongooseConn.conn;

  if (!global.mongooseConn.promise) {
    global.mongooseConn.promise = mongoose.connect(MONGODB_URI);
  }

  global.mongooseConn.conn = await global.mongooseConn.promise;
  return global.mongooseConn.conn;
}