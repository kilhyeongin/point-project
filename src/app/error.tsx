"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "oklch(0.97 0.012 25)" }}
        >
          <span className="text-3xl">⚠️</span>
        </div>
        <div>
          <h1
            className="text-foreground font-black"
            style={{ fontSize: "1.375rem", letterSpacing: "-0.03em" }}
          >
            오류가 발생했습니다
          </h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            예기치 않은 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="w-full h-11 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: "oklch(0.52 0.27 264)" }}
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
