"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CustomerShellClient from "../CustomerShellClient";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";

type SessionInfo = {
  uid: string;
  username: string;
  name: string;
  role: string;
};

type Props = {
  session: SessionInfo;
};

export default function CustomerQrClient({ session }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/me/balance", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setBalance(Number(d.balance ?? 0)); })
      .catch(() => {});
  }, []);

  const fetchQr = useCallback(async () => {
    setLoading(true);
    setError("");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const res = await fetch("/api/me/qr-token", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "QR 생성에 실패했습니다.");
        return;
      }

      const dataUrl = await QRCode.toDataURL(data.token, {
        width: 280,
        margin: 2,
        color: { dark: "#0d1117", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });

      setQrDataUrl(dataUrl);
      const total = Number(data.expiresInSec ?? 180);
      setSecondsLeft(total);

      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQr();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchQr]);

  const expired = secondsLeft === 0 && !loading;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <CustomerShellClient
      session={session}
      title="포인트 결제 QR"
      description="제휴사 직원에게 이 화면을 보여주세요."
    >
      <div className="space-y-4">
        {/* QR 카드 */}
        <div className="bg-card shadow-elevated rounded-3xl overflow-hidden">
          {/* 상단 컬러 띠 */}
          <div
            className="h-1.5 w-full"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.52 0.27 264), oklch(0.62 0.22 240))",
            }}
          />

          <div className="p-6 flex flex-col items-center gap-5">
            {/* 보유 포인트 */}
            {balance !== null && (
              <div className="text-center">
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                  보유 포인트
                </p>
                <p
                  className="font-black text-foreground"
                  style={{ fontSize: "1.875rem", letterSpacing: "-0.04em" }}
                >
                  {balance.toLocaleString()}
                  <span className="text-xl ml-1.5 text-muted-foreground font-bold">P</span>
                </p>
              </div>
            )}

            {/* QR 이미지 영역 */}
            <div className="relative">
              {loading ? (
                <div
                  className="flex items-center justify-center rounded-2xl bg-muted"
                  style={{ width: 280, height: 280 }}
                >
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div
                  className="flex flex-col items-center justify-center rounded-2xl bg-destructive/5 gap-3"
                  style={{ width: 280, height: 280 }}
                >
                  <p className="text-sm font-semibold text-destructive text-center px-6">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={fetchQr}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: "oklch(0.52 0.27 264)" }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    다시 시도
                  </button>
                </div>
              ) : (
                <>
                  <img
                    src={qrDataUrl}
                    alt="포인트 결제 QR"
                    width={280}
                    height={280}
                    className={`rounded-2xl block transition-all duration-300 ${
                      expired ? "opacity-20 blur-sm" : ""
                    }`}
                  />
                  {expired && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl">
                      <p className="text-sm font-black text-foreground">QR 만료됨</p>
                      <button
                        type="button"
                        onClick={fetchQr}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                        style={{ background: "oklch(0.52 0.27 264)" }}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        새로고침
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 타이머 */}
            {!loading && !error && (
              <div className="flex flex-col items-center gap-2 w-full">
                <div
                  className={`font-black tabular-nums transition-colors ${
                    expired
                      ? "text-destructive"
                      : secondsLeft <= 30
                      ? "text-orange-500"
                      : "text-foreground"
                  }`}
                  style={{ fontSize: "1.625rem", letterSpacing: "-0.02em" }}
                >
                  {mins}:{secs}
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {expired ? "만료됨 — 아래 새로고침을 눌러주세요" : "후 자동 만료"}
                </p>

                {!expired && (
                  <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-linear"
                      style={{
                        width: `${(secondsLeft / 180) * 100}%`,
                        background:
                          secondsLeft <= 30
                            ? "oklch(0.65 0.2 45)"
                            : "oklch(0.52 0.27 264)",
                      }}
                    />
                  </div>
                )}

                {!expired && (
                  <button
                    type="button"
                    onClick={fetchQr}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    수동 새로고침
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-muted/50 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            이용 안내
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground font-medium leading-relaxed">
            <li>• QR 코드는 <strong className="text-foreground">3분</strong>간 유효합니다.</li>
            <li>• 제휴사 직원이 스캔하면 포인트가 즉시 사용됩니다.</li>
            <li>• 만료 후 새로고침 버튼을 눌러 재발급하세요.</li>
            <li>• 타인에게 QR을 공유하지 마세요.</li>
          </ul>
        </div>
      </div>
    </CustomerShellClient>
  );
}
