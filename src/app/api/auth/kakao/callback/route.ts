import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { signSession, setSessionCookie } from "@/lib/auth";

interface KakaoTokenResponse {
  access_token?: string;
  error?: string;
}

interface KakaoProfile {
  id: number;
  kakao_account?: {
    email?: string;
    phone_number?: string; // "+82 10-1234-5678" 형식
    name?: string;
    profile?: {
      nickname?: string;
    };
  };
}

async function getKakaoToken(code: string): Promise<string | null> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.KAKAO_CLIENT_ID!,
    client_secret: process.env.KAKAO_CLIENT_SECRET ?? "",
    redirect_uri: process.env.KAKAO_CALLBACK_URL!,
    code,
  });

  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  const data: KakaoTokenResponse = await res.json();
  return data.access_token ?? null;
}

async function getKakaoProfile(accessToken: string): Promise<KakaoProfile | null> {
  const res = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<KakaoProfile>;
}

export async function GET(req: Request) {
  const callbackUrl = process.env.KAKAO_CALLBACK_URL!;
  const baseUrl = new URL(callbackUrl).origin;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/login?error=kakao_denied", baseUrl));
  }

  // CSRF state 검증
  const cookieStore = await cookies();
  const savedState = cookieStore.get("kakao_oauth_state")?.value;
  cookieStore.delete("kakao_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL("/login?error=kakao_state", baseUrl));
  }

  try {
    const accessToken = await getKakaoToken(code);
    if (!accessToken) {
      return NextResponse.redirect(new URL("/login?error=kakao_token", baseUrl));
    }

    const profile = await getKakaoProfile(accessToken);
    if (!profile) {
      return NextResponse.redirect(new URL("/login?error=kakao_profile", baseUrl));
    }

    await connectDB();

    const kakaoId = String(profile.id);
    const kakaoEmail = profile.kakao_account?.email?.toLowerCase() ?? "";
    const kakaoName = profile.kakao_account?.name ?? profile.kakao_account?.profile?.nickname ?? "카카오 사용자";
    // "+82 10-1234-5678" → "01012345678"
    const rawPhone = profile.kakao_account?.phone_number ?? "";
    const kakaoPhone = rawPhone
      .replace("+82 ", "0")
      .replace(/-/g, "")
      .replace(/\s/g, "");

    // 1. 기존 카카오 소셜 계정으로 연결된 유저 찾기
    let user = await User.findOne({
      "socialAccounts.provider": "kakao",
      "socialAccounts.providerId": kakaoId,
    });

    if (!user && kakaoEmail) {
      // 2. 동일 이메일의 일반 계정 찾기 → 소셜 계정 연결
      user = await User.findOne({ email: kakaoEmail, role: "CUSTOMER" });
      if (user) {
        user.socialAccounts.push({ provider: "kakao", providerId: kakaoId });
        await user.save();
      }
    }

    if (!user) {
      // 3. 신규 고객 계정 생성
      const username = `kakao_${kakaoId}`;
      user = await User.create({
        username,
        email: kakaoEmail,
        passwordHash: "",
        name: kakaoName,
        role: "CUSTOMER",
        status: "ACTIVE",
        socialAccounts: [{ provider: "kakao", providerId: kakaoId }],
        customerProfile: {
          phone: kakaoPhone,
          onboardingCompleted: false,
          interests: [],
        },
      });
    }

    if (user.status === "BLOCKED") {
      return NextResponse.redirect(new URL("/login?error=blocked", baseUrl));
    }

    const token = signSession({
      uid: user._id.toString(),
      role: user.role,
      username: user.username,
      name: user.name,
    });

    await setSessionCookie(token);

    return NextResponse.redirect(new URL("/customer", baseUrl));
  } catch (err) {
    console.error("[KAKAO_CALLBACK_ERROR]", err);
    return NextResponse.redirect(new URL("/login?error=server", baseUrl));
  }
}
