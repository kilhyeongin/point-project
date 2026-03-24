// src/lib/settlementPeriod.ts
export function getPreviousMonthRange(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth(); // 0-based

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

  return { from, to, periodKey };
}