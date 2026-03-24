// src/app/partner/scan/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";
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

  const qrRef = useRef<Html5QrcodeType | null>(null);
  const isRunningRef = useRef(false);
  const regionId = "qr-reader-region";

  async function stopScanner() {
    const qr = qrRef.current;
    if (!qr || !isRunningRef.current) return;
    isRunningRef.current = false;
    try {
      await qr.stop();
    } catch {
      // already stopped — ignore
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const qr = new Html5Qrcode(regionId);
      qrRef.current = qr;

      setMsg("");
      try {
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (!isIOS) {
          const permStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          permStream.getTracks().forEach(t => t.stop());
          if (cancelled) { try { qr.clear(); } catch {} return; }
        }

        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 280 },
          (decodedText) => {
            if (cancelled) return;
            isRunningRef.current = false;
            try { qr.stop(); } catch {}
            setScanned(decodedText);
            setMsg("스캔 완료. 금액 입력 후 차감요청을 생성하세요.");
          },
          () => {}
        );
        isRunningRef.current = true;
      } catch {
        if (!cancelled) setMsg("카메라 시작 실패 (권한을 허용했는지 확인)");
      }
    })();

    return () => {
      cancelled = true;
      stopScanner().finally(() => {
        try { qrRef.current?.clear(); } catch {}
        qrRef.current = null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUseRequestByQr() {
    setMsg("");

    if (!scanned) {
      setMsg("먼저 QR을 스캔해주세요.");
      return;
    }
    if (amountNum <= 0) {
      setMsg("금액을 1 이상 입력해주세요.");
      return;
    }

    try {
      const res = await fetch("/api/partner/use-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrPayload: scanned,
          amount: amountNum,
          note: note.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message ?? "차감요청 생성 실패");
        return;
      }

      const instant = data?.instant ?? false;
      setMsg(
        instant
          ? `차감 완료 / ${formatNumber(amountNum)}P → 잔액 ${formatNumber(data?.balanceAfter ?? 0)}P`
          : `차감요청 생성됨(승인대기) / ${formatNumber(amountNum)}P`
      );
      setScanned("");
      setAmountText("0");
      setNote("");

      const qr = qrRef.current;
      if (qr) {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 280 },
          (decodedText) => {
            isRunningRef.current = false;
            try { qr.stop(); } catch {}
            setScanned(decodedText);
            setMsg("스캔 완료. 금액 입력 후 차감요청을 생성하세요.");
          },
          () => {}
        );
        isRunningRef.current = true;
      }
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
        <div id={regionId} className="rounded-xl overflow-hidden min-h-64 w-full" />
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
