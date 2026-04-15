// src/app/[orgSlug]/partner/scan/page.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, CheckCircle2, XCircle } from "lucide-react";

function onlyDigitsToNumber(v: string) {
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}
function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

type CameraState = "idle" | "loading" | "active" | "error";

type ResultOverlay = {
  type: "success" | "error";
  title: string;
  lines: string[];
};

export default function PartnerScanPage() {
  const [mode, setMode] = useState<"USE" | "GRANT">("USE");
  const [scanned, setScanned] = useState<string>("");
  const [amountText, setAmountText] = useState<string>("0");
  const [note, setNote] = useState<string>("");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string>("");
  const [loadingRetries, setLoadingRetries] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultOverlay | null>(null);

  const amountNum = useMemo(() => onlyDigitsToNumber(amountText), [amountText]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanningRef = useRef(false);
  const cancelLoadingRef = useRef(false);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showResult(overlay: ResultOverlay, autoRestartCamera = true) {
    setResult(overlay);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => {
      setResult(null);
      if (autoRestartCamera && overlay.type === "success") {
        setScanned("");
        setAmountText("0");
        setNote("");
        startCamera((text) => setScanned(text));
      }
    }, 3000);
  }

  function stopCamera() {
    scanningRef.current = false;
    cancelLoadingRef.current = true;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    setCameraState("idle");
  }

  async function startCamera(onFound: (text: string) => void) {
    stopCamera();
    cancelLoadingRef.current = false;
    setCameraState("loading");
    setCameraError("");
    setLoadingRetries(0);

    try {
      const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
      if (perm.state === "denied") {
        setCameraError("blocked");
        setCameraState("error");
        return;
      }
    } catch {
      // permissions API 미지원 브라우저는 그냥 진행
    }

    async function tryGetStream(): Promise<MediaStream | null> {
      const constraints = [
        { video: { facingMode: { ideal: "environment" } } },
        { video: true },
      ];
      let attempt = 0;
      while (!cancelLoadingRef.current) {
        const constraint = constraints[attempt % 2 === 0 ? 0 : 1];
        try {
          return await navigator.mediaDevices.getUserMedia(constraint);
        } catch (e) {
          const name = e instanceof Error ? e.name : "";
          if (name === "NotFoundError" || name === "DevicesNotFoundError") throw e;
        }
        attempt++;
        setLoadingRetries(attempt);
        await new Promise(r => setTimeout(r, 1000));
      }
      return null;
    }

    try {
      const stream = await tryGetStream();
      if (!stream) return;
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = stream;
      await video.play();
      scanningRef.current = true;
      setCameraState("active");

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
              // QR not found in this frame
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
      const name = err instanceof Error ? err.name : "";
      const msg = err instanceof Error ? err.message : String(err);
      const errorMsg = (name === "NotFoundError" || name === "DevicesNotFoundError")
        ? "카메라를 찾을 수 없습니다. 기기에 카메라가 있는지 확인해주세요."
        : `카메라를 시작할 수 없습니다. (${name || msg})`;
      setCameraError(errorMsg);
      setCameraState("error");
    }
  }

  function handleStartCamera() {
    startCamera((text) => {
      setScanned(text);
    });
  }

  async function submitRequest() {
    if (!scanned) {
      showResult({ type: "error", title: "스캔 필요", lines: ["먼저 QR을 스캔해주세요."] }, false);
      return;
    }
    if (amountNum <= 0) {
      showResult({ type: "error", title: "금액 오류", lines: ["금액을 1 이상 입력해주세요."] }, false);
      return;
    }

    setSubmitting(true);
    try {
      const isGrant = mode === "GRANT";
      const url = isGrant ? "/api/partner/grant-requests" : "/api/partner/use-requests";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrPayload: scanned, amount: amountNum, note: note.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        showResult({
          type: "error",
          title: isGrant ? "적립 실패" : "사용 실패",
          lines: [data?.message ?? "오류가 발생했습니다."],
        }, false);
        setScanned("");
        setAmountText("0");
        startCamera((text) => setScanned(text));
        return;
      }

      if (isGrant) {
        showResult({
          type: "success",
          title: "적립 완료 ✓",
          lines: [
            `${formatNumber(amountNum)}P 지급`,
            `내 잔액 ${formatNumber(data?.partnerBalanceAfter ?? 0)}P`,
          ],
        });
      } else {
        const instant = data?.instant ?? false;
        showResult({
          type: "success",
          title: instant ? "포인트 사용 완료 ✓" : "사용 요청 접수 ✓",
          lines: instant
            ? [
                `${formatNumber(amountNum)}P 사용`,
                `고객 잔액 ${formatNumber(data?.balanceAfter ?? 0)}P`,
              ]
            : [
                `${formatNumber(amountNum)}P`,
                "승인 대기 중",
              ],
        });
      }
    } catch {
      showResult({
        type: "error",
        title: "네트워크 오류",
        lines: ["잠시 후 다시 시도해주세요."],
      }, false);
      setScanned("");
      setAmountText("0");
      startCamera((text) => setScanned(text));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* 결과 오버레이 */}
      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)" }}
          onClick={() => {
            if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
            setResult(null);
          }}
        >
          <div
            className="mx-4 w-full max-w-xs rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl"
            style={{
              background: result.type === "success"
                ? "oklch(0.97 0.05 150)"
                : "oklch(0.97 0.05 20)",
            }}
          >
            {result.type === "success" ? (
              <CheckCircle2
                className="w-16 h-16"
                style={{ color: "oklch(0.52 0.18 160)" }}
              />
            ) : (
              <XCircle
                className="w-16 h-16"
                style={{ color: "oklch(0.55 0.22 25)" }}
              />
            )}
            <p
              className="text-xl font-black text-center"
              style={{
                color: result.type === "success"
                  ? "oklch(0.35 0.15 160)"
                  : "oklch(0.40 0.18 25)",
              }}
            >
              {result.title}
            </p>
            {result.lines.map((line, i) => (
              <p
                key={i}
                className="text-base font-bold text-center"
                style={{
                  color: result.type === "success"
                    ? "oklch(0.45 0.12 160)"
                    : "oklch(0.50 0.14 25)",
                }}
              >
                {line}
              </p>
            ))}
            <p className="text-xs text-center mt-1" style={{ color: "oklch(0.60 0.05 150)" }}>
              탭하면 닫힙니다
            </p>
          </div>
        </div>
      )}

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

        {cameraState === "idle" && (
          <div className="w-full rounded-xl bg-muted flex flex-col items-center justify-center gap-4 py-10">
            <QrCode className="w-12 h-12 text-muted-foreground/40" />
            <Button
              type="button"
              onClick={handleStartCamera}
              className="h-12 px-8 text-base font-bold"
              style={{ background: "oklch(0.52 0.27 264)" }}
            >
              QR 스캔 시작
            </Button>
            <p className="text-xs text-muted-foreground">버튼을 누르면 카메라 권한을 요청합니다</p>
          </div>
        )}

        {cameraState === "loading" && (
          <div className="w-full rounded-xl bg-muted flex flex-col items-center justify-center gap-3 py-10 px-4">
            <p className="text-sm text-muted-foreground font-semibold">카메라 여는 중...</p>
            {loadingRetries < 3 ? (
              <p className="text-xs text-muted-foreground/70 text-center">권한 요청이 뜨면 허용을 눌러주세요</p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-amber-600 font-semibold text-center">
                  권한 창이 뜨지 않으면 페이지를 새로고침해주세요
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="h-9 px-5 rounded-xl bg-amber-500 text-white text-xs font-bold"
                >
                  새로고침
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={stopCamera}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              취소
            </button>
          </div>
        )}

        {cameraState === "error" && (
          <div className="w-full rounded-xl bg-red-50 border border-red-200 flex flex-col items-center justify-center gap-3 py-8 px-4">
            {cameraError === "blocked" ? (
              <>
                <p className="text-sm text-red-600 font-semibold text-center">카메라가 차단되어 있습니다</p>
                <p className="text-xs text-red-500 text-center leading-relaxed">
                  주소창 자물쇠 아이콘 → 카메라 → <strong>허용</strong>으로 변경 후<br />페이지를 새로고침해주세요
                </p>
                <Button type="button" onClick={() => window.location.reload()} className="h-10 px-6 text-sm font-bold bg-red-500 hover:bg-red-600 text-white">
                  새로고침
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-red-600 font-semibold text-center">{cameraError}</p>
                <Button type="button" onClick={handleStartCamera} variant="outline" className="h-10 px-6 text-sm font-bold">
                  다시 시도
                </Button>
              </>
            )}
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full rounded-xl ${cameraState === "active" ? "block" : "hidden"}`}
          style={{ minHeight: "200px", background: "#000" }}
        />

        {scanned && cameraState === "idle" && (
          <button
            type="button"
            onClick={handleStartCamera}
            className="mt-3 w-full h-9 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
          >
            다시 스캔
          </button>
        )}
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
            disabled={submitting}
            className={`w-full h-11 font-bold ${mode === "GRANT" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}`}
          >
            {submitting ? "처리 중..." : mode === "GRANT" ? "포인트 적립" : "포인트 사용요청"}
          </Button>
        </div>
      </div>
    </div>
  );
}
