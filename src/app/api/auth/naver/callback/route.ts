import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { signSession, setSessionCookie } from "@/lib/auth";

interface NaverTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface NaverProfile {
  id: string;
  email?: string;
  name?: string;
  mobile?: string; // "010-xxxx-xxxx" 형식
}

async function getNaverToken(code: string, state: string): Promise<string | null> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.NAVER_CLIENT_ID!,
    client_secret: process.env.NAVER_CLIENT_SECRET!,
    redirect_uri: process.env.NAVER_CALLBACK_URL!,
    code,
    state,
  });

  const res = await fetch(
    `https://nid.naver.com/oauth2.0/token?${params.toString()}`,
    { method: "GET", cache: "no-store" }
  );
  const data: NaverTokenResponse = await res.json();
  return data.access_token ?? null;
}

async function getNaverProfile(accessToken: string): Promise<NaverProfile | null> {
  const res = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (data.resultcode !== "00") return null;
  return data.response as NaverProfile;
}

export async function GET(req: Request) {
  // 프록시 환경에서 req.url이 localhost로 잡히는 문제 방지
  const callbackUrl = process.env.NAVER_CALLBACK_URL!;
  const baseUrl = new URL(callbackUrl).origin; // "https://uppoint.kr"

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // CSRF state 검증
  const cookieStore = await cookies();
  const savedState = cookieStore.get("naver_oauth_state")?.value;
  const orgSlug = cookieStore.get("naver_oauth_org")?.value ?? "default";
  cookieStore.delete("naver_oauth_state");
  cookieStore.delete("naver_oauth_org");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL(`/${orgSlug}/login?error=naver_denied`, baseUrl));
  }

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL(`/${orgSlug}/login?error=naver_state`, baseUrl));
  }

  try {
    const accessToken = await getNaverToken(code, state);
    if (!accessToken) {
      return NextResponse.redirect(new URL(`/${orgSlug}/login?error=naver_token`, baseUrl));
    }

    const profile = await getNaverProfile(accessToken);
    if (!profile) {
      return NextResponse.redirect(new URL(`/${orgSlug}/login?error=naver_profile`, baseUrl));
    }

    await connectDB();

    const naverId = profile.id;
    const naverEmail = profile.email?.toLowerCase() ?? "";
    const naverName = profile.name ?? "네이버 사용자";
    const naverPhone = profile.mobile?.replace(/-/g, "") ?? ""; // "01012345678"

    // 1. 기존 네이버 소셜 계정으로 연결된 유저 찾기
    let user = await User.findOne({
      "socialAccounts.provider": "naver",
      "socialAccounts.providerId": naverId,
    });

    if (!user && naverEmail) {
      // 2. 동일 이메일의 일반 계정 찾기 → 소셜 계정 연결
      user = await User.findOne({ email: naverEmail, role: "CUSTOMER" });
      if (user) {
        user.socialAccounts.push({ provider: "naver", providerId: naverId });
        await user.save();
      }
    }

    if (!user) {
      // 3. 신규 고객 계정 생성
      const username = `naver_${naverId}`;
      user = await User.create({
        username,
        email: naverEmail,
        passwordHash: "",
        name: naverName,
        role: "CUSTOMER",
        status: "ACTIVE",
        socialAccounts: [{ provider: "naver", providerId: naverId }],
        customerProfile: {
          phone: naverPhone,
          onboardingCompleted: false,
          interests: [],
        },
      });
    }

    if (user.status === "BLOCKED") {
      return NextResponse.redirect(new URL(`/${orgSlug}/login?error=blocked`, baseUrl));
    }

    const token = signSession({
      uid: user._id.toString(),
      role: user.role,
      username: user.username,
      name: user.name,
      orgId: user.organizationId ?? "default",
    });

    await setSessionCookie(token);

    return NextResponse.redirect(new URL(`/${user.organizationId ?? orgSlug}/customer`, baseUrl));
  } catch (err) {
    console.error("[NAVER_CALLBACK_ERROR]", err);
    return NextResponse.redirect(new URL(`/${orgSlug}/login?error=server`, baseUrl));
  }
}
