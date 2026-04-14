// src/lib/settlementLock.ts
// =======================================================
// 운영형 정산 LOCK 체크 유틸
// -------------------------------------------------------
// 기준:
// - 특정 날짜가 속한 YYYY-MM(periodKey)에 Settlement 라인이 있으면
//   해당 월은 이미 정산 마감된 것으로 간주
// - 현재 월/지난달/특정 월 모두 periodKey 기준으로 판단
// =======================================================

import { Settlement } from "@/models/Settlement";

export function toPeriodKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export async function isSettlementLockedByPeriodKey(periodKey: string, orgId: string) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return false;

  const exists = await Settlement.exists({ organizationId: orgId, periodKey });
  return Boolean(exists);
}

export async function isSettlementLockedByDate(date: Date, orgId: string) {
  const periodKey = toPeriodKey(date);
  return isSettlementLockedByPeriodKey(periodKey, orgId);
}