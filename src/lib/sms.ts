// CoolSMS (솔라피) 연동
// 사용법: .env.local 에 아래 3개 추가
//   COOLSMS_API_KEY=...
//   COOLSMS_API_SECRET=...
//   COOLSMS_SENDER=01012345678  (발신번호)

type SmsResult = { ok: boolean; messageId?: string; error?: string };

export async function sendSms(
  to: string,
  text: string
): Promise<SmsResult> {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  const sender = process.env.COOLSMS_SENDER;

  // 전화번호 정규화 (010-1234-5678 → 01012345678)
  const normalizedTo = to.replace(/[^0-9]/g, "");

  if (!normalizedTo || normalizedTo.length < 10) {
    return { ok: false, error: "유효하지 않은 전화번호" };
  }

  if (!apiKey || !apiSecret || !sender) {
    // API 키 없으면 콘솔 로그로 대체 (개발/테스트용)
    console.log(`[SMS MOCK] to=${normalizedTo}\n${text}`);
    return { ok: true, messageId: `MOCK-${Date.now()}` };
  }

  try {
    // CoolSMS REST API v4
    const timestamp = String(Date.now());
    const salt = Math.random().toString(36).slice(2);
    const signature = await makeCoolsmsSignature(apiSecret, timestamp, salt);

    const res = await fetch("https://api.coolsms.co.kr/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({
        message: {
          to: normalizedTo,
          from: sender.replace(/[^0-9]/g, ""),
          text,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[SMS_ERROR]", data);
      return { ok: false, error: data?.errorMessage ?? "SMS 발송 실패" };
    }

    return { ok: true, messageId: data?.groupId ?? "" };
  } catch (error) {
    console.error("[SMS_ERROR]", error);
    return { ok: false, error: "SMS 발송 중 오류" };
  }
}

async function makeCoolsmsSignature(
  secret: string,
  timestamp: string,
  salt: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const message = encoder.encode(timestamp + salt);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildGiftCardSmsText(params: {
  productName: string;
  pinNumber: string;
  expiresAt: Date | null;
}): string {
  const expiry = params.expiresAt
    ? `${params.expiresAt.getFullYear()}.${String(params.expiresAt.getMonth() + 1).padStart(2, "0")}.${String(params.expiresAt.getDate()).padStart(2, "0")}`
    : "";

  return [
    `[포인트몰] 상품권 구매 완료`,
    `상품: ${params.productName}`,
    `핀번호: ${params.pinNumber}`,
    expiry ? `유효기간: ~${expiry}` : "",
    `구매내역은 앱에서 확인하세요.`,
  ]
    .filter(Boolean)
    .join("\n");
}
