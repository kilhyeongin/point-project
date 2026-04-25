// src/app/api/partner/upload-url/route.ts
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSessionFromCookies } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "PARTNER") {
    return NextResponse.json({ ok: false, message: "제휴사만 업로드할 수 있습니다." }, { status: 403 });
  }

  if (await isRateLimited(`upload-url:${session.uid}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const contentType = String(body?.contentType ?? "").trim();
  const fileSize = Number(body?.fileSize ?? 0);

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ ok: false, message: "JPG, PNG, WEBP, GIF만 업로드 가능합니다." }, { status: 400 });
  }
  if (fileSize > MAX_SIZE) {
    return NextResponse.json({ ok: false, message: "파일 크기는 5MB 이하만 가능합니다." }, { status: 400 });
  }

  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  const key = `partner-covers/${session.uid}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return NextResponse.json({ ok: true, uploadUrl, publicUrl });
}
