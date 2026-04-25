// src/app/api/me/qr-token/route.ts
// =======================================================
// CUSTOMER: QR 토큰 발급 API
// -------------------------------------------------------
// ✔ 로그인 필요
// ✔ CUSTOMER만
// ✔ 짧은 유효기간(exp) JWT 발급
// ✔ payload: { sub: customerId, typ: "customer_qr" }
// =======================================================

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "CUSTOMER") {
    return NextResponse.json({ ok: false, message: "고객만 사용할 수 있습니다." }, { status: 403 });
  }

  const secret = process.env.QR_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "QR_SECRET이 설정되어 있지 않습니다." }, { status: 500 });
  }

  const token = jwt.sign(
    {
      typ: "customer_qr",
    },
    secret,
    {
      subject: String(session.uid),
      expiresIn: "3m",
      issuer: "point-platform",
      audience: "partner-scan",
      jwtid: randomUUID(),
    }
  );

  return NextResponse.json({ ok: true, token, expiresInSec: 180 });
}