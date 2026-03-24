// src/app/partner/scan/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, CheckCircle2 } from "lucide-react";

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
  const [scanned, setScanned] = useState<string>("");
  const [amountText, setAmountText] = useState<string>("0");
  const [note, setNote] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

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
      setMsg(`카메라 시작 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  useEffect(() => {
    startCamera((text) => {
      setScanned(text);
      setMsg("스캔 완료. 금액 입력 후 차감요청을 생성하세요.");
    });
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUseRequestByQr() {
    setMsg("");
    if (!scanned) { setMsg("먼저 QR을 스캔해주세요."); return; }
    if (amountNum <= 0) { setMsg("금액을 1 이상 입력해주세요."); return; }

    try {
      const res = await fetch("/api/partner/use-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrPayload: scanned, amount: amountNum, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data?.message ?? "차감요청 생성 실패"); return; }

      const instant = data?.instant ?? false;
      setMsg(
        instant
          ? `차감 완료 / ${formatNumber(amountNum)}P → 잔액 ${formatNumber(data?.balanceAfter ?? 0)}P`
          : `차감요청 생성됨(승인대기) / ${formatNumber(amountNum)}P`
      );
      setScanned("");
      setAmountText("0");
      setNote("");

      startCamera((text) => {
        setScanned(text);
        setMsg("스캔 완료. 금액 입력 후 차감요청을 생성하세요.");
      });
    } catch {
      setMsg("네트워크 오류");
    }
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-black text-foreground tracking-tight">QR 스캔 결제</h1>
        <p className="text-sm text-muted-foreground mt-1">
          고객이 보여주는 QR을 스캔하고, 금액을 입력해 차감요청을 생성합니다.
        </p>
      </div>

      {msg && (
        <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-semibold border ${
          msg.includes("실패") || msg.includes("오류") || msg.includes("먼저") || msg.includes("입력")
            ? "bg-destructive/8 border-destructive/20 text-destructive"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          {!msg.includes("실패") && !msg.includes("오류") && (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          {msg}
        </div>
      )}

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
              차감 금액
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
            onClick={createUseRequestByQr}
            className="w-full h-11 font-bold"
          >
            차감요청 생성
          </Button>
        </div>
      </div>
    </div>
  );
}
