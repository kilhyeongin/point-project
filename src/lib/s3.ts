// src/lib/s3.ts
// S3 파일 삭제 유틸

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "@/lib/logger";

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = process.env.AWS_S3_BUCKET!;

/** URL이 우리 S3 버킷 파일인지 확인 */
function isOurS3Url(url: string): boolean {
  if (!url || !BUCKET) return false;
  return url.startsWith(`https://${BUCKET}.s3.`);
}

/** S3 URL에서 key 추출 */
function extractS3Key(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    return pathname.startsWith("/") ? pathname.slice(1) : pathname;
  } catch {
    return null;
  }
}

/** S3에서 단일 파일 삭제 (에러는 warn만 — 메인 흐름 막지 않음) */
export async function deleteS3Object(url: string): Promise<void> {
  if (!isOurS3Url(url)) return;
  const key = extractS3Key(url);
  if (!key) return;

  try {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    logger.warn("[S3_DELETE_WARN]", { url, err });
  }
}

/** 이전 URL 목록과 새 URL 목록을 비교해서 사라진 것들 S3에서 삭제 */
export async function deleteRemovedS3Objects(
  oldUrls: (string | null | undefined)[],
  newUrls: (string | null | undefined)[]
): Promise<void> {
  const newSet = new Set(newUrls.filter(Boolean));
  const toDelete = oldUrls.filter((u) => u && !newSet.has(u)) as string[];
  await Promise.all(toDelete.map(deleteS3Object));
}
