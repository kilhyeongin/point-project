// src/lib/logger.ts
// 구조화된 운영 로거 (JSON 포맷 → CloudWatch/로그 수집기 친화적)

type Level = "info" | "warn" | "error";

function log(level: Level, message: string, data?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(data ?? {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, err?: unknown, data?: Record<string, unknown>) => {
    const errData: Record<string, unknown> = { ...data };
    if (err instanceof Error) {
      errData.error = err.message;
      errData.stack = err.stack?.split("\n").slice(0, 5).join(" | ");
    } else if (err !== undefined) {
      errData.error = String(err);
    }
    log("error", msg, errData);
  },
};
