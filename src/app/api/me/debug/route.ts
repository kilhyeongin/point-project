// src/app/api/me/debug/route.ts
// 디버그 엔드포인트 비활성화 (보안)
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
}