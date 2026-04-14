import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get("orgSlug") ?? "default";

  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set("kakao_oauth_org", orgSlug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  cookieStore.set("kakao_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10분
  });

  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID!,
    redirect_uri: process.env.KAKAO_CALLBACK_URL!,
    response_type: "code",
    state,
    scope: "account_email",
  });

  return NextResponse.redirect(
    `https://kauth.kakao.com/oauth/authorize?${params.toString()}`
  );
}
