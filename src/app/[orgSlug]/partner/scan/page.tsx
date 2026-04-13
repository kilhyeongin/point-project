// src/app/[orgSlug]/partner/scan/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode } from "lucide-react";

function onlyDigitsToNumber(v: string) {
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}
function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

export default function PartnerScanPage() {
  const [mode, setMode] = useState<"USE" | "GRANT">("USE");
  const [scanned, setScanned] = useState<string>("");
  const [amountText, setAmountText] = useState<string>("0");
  const [note, setNote] = useState<string>("");

  const amountNum = useMemo(() => onlyDigitsToNumber(amountText), [amountText]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanningRef = useRef(false);

  function stopCamera() {
    scanningRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
  }

  async function startCamera(onFound: (text: string) => void) {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = stream;
      await video.play();
      scanningRef.current = true;

      const { Html5Qrcode } = await import("html5-qrcode");
      const decoder = new Html5Qrcode("qr-decoder-hidden");

      async function scanFrame() {
        if (!scanningRef.current || !videoRef.current) return;
        const v = videoRef.current;
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (!w || !h) { timerRef.current = setTimeout(scanFrame, 300); return; }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { timerRef.current = setTimeout(scanFrame, 300); return; }
        ctx.drawImage(v, 0, 0, w, h);

        await new Promise<void>(resolve => {
          canvas.toBlob(async (blob) => {
            if (!blob) { resolve(); return; }
            try {
              const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
              const result = await decoder.scanFile(file, false);
              if (scanningRef.current) {
                scanningRef.current = false;
                stopCamera();
                onFound(result);
              }
            } catch {
              // QR not found in this frame, continue
            }
            resolve();
          }, "image/jpeg", 0.8);
        });

        if (scanningRef.current) {
          timerRef.current = setTimeout(scanFrame, 200);
        }
      }

      timerRef.current = setTimeout(scanFrame, 500);
    } catch (err) {
      alert(`카메라 시작 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  useEffect(() => {
    startCamera((text) => {
      setScanned(text);
      alert("스캔 완료. 금액 입력 후 처리하세요.");
    });
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitRequest() {
    if (!scanned) { alert("먼저 QR을 스캔해주세요."); return; }
    if (amountNum <= 0) { alert("금액을 1 이상 입력해주세요."); return; }

    try {
      const isGrant = mode === "GRANT";
      const url = isGrant ? "/api/partner/grant-requests" : "/api/partner/use-requests";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrPayload: scanned, amount: amountNum, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.message ?? (isGrant ? "적립 실패" : "사용 실패"));
        setScanned("");
        setAmountText("0");
        startCamera((text) => { setScanned(text); alert("스캔 완료. 금액 입력 후 처리하세요."); });
        return;
      }

      if (isGrant) {
        alert(`적립 완료!\n${formatNumber(amountNum)}P 지급 → 내 잔액 ${formatNumber(data?.partnerBalanceAfter ?? 0)}P`);
      } else {
        const instant = data?.instant ?? false;
        alert(
          instant
            ? `포인트 사용 완료!\n${formatNumber(amountNum)}P 사용 → 고객 잔액 ${formatNumber(data?.balanceAfter ?? 0)}P`
            : `사용요청 생성됨\n${formatNumber(amountNum)}P (승인 대기 중)`
        );
      }

      setScanned("");
      setAmountText("0");
      setNote("");

      startCamera((text) => {
        setScanned(text);
        alert("스캔 완료. 금액 입력 후 처리하세요.");
      });
    } catch {
      alert("네트워크 오류가 발생했습니다.");
      setScanned("");
      setAmountText("0");
      startCamera((text) => { setScanned(text); alert("스캔 완료. 금액 입력 후 처리하세요."); });
    }
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-black text-foreground tracking-tight">QR 스캔</h1>
        <p className="text-sm text-muted-foreground mt-1">
          고객이 보여주는 QR을 스캔하고, 금액을 입력해 처리합니다.
        </p>
      </div>

      {/* 사용 / 적립 토글 */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setMode("USE")}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
            mode === "USE"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          사용
        </button>
        <button
          type="button"
          onClick={() => setMode("GRANT")}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
            mode === "GRANT"
              ? "bg-emerald-500 text-white"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          적립
        </button>
      </div>

      {/* QR Scanner */}
      <div className="bg-card shadow-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <QrCode className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">QR 카메라</span>
        </div>
        <div id="qr-decoder-hidden" style={{ display: "none" }} />
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full rounded-xl"
          style={{ minHeight: "200px", background: "#000" }}
        />
      </div>

      {/* Form */}
      <div className="bg-card shadow-card rounded-2xl p-4 space-y-4">
        <div>
          <div className="text-xs font-bold text-muted-foreground mb-2">스캔 결과</div>
          <div className={`p-3 rounded-xl border text-sm break-all ${
            scanned
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold"
              : "bg-muted border-border text-muted-foreground"
          }`}>
            {scanned || "아직 스캔되지 않았습니다."}
          </div>
        </div>

        <div className="border-t border-border/60 pt-4 space-y-3">
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">
              {mode === "GRANT" ? "적립 금액" : "사용 금액"}
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={amountText}
                onChange={(e) => {
                  const n = onlyDigitsToNumber(e.target.value);
                  setAmountText(formatNumber(n));
                }}
                inputMode="numeric"
                className="h-11 text-right font-bold"
              />
              <span className="text-sm font-black text-foreground shrink-0">P</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">
              메모 (선택)
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="메모를 입력하세요"
              className="h-11"
            />
          </div>

          <Button
            type="button"
            onClick={submitRequest}
            className={`w-full h-11 font-bold ${mode === "GRANT" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}`}
          >
            {mode === "GRANT" ? "포인트 적립" : "포인트 사용요청"}
          </Button>
        </div>
      </div>
    </div>
  );
}
