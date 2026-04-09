// src/app/[orgSlug]/me/qr/page.tsx
// =======================================================
// CUSTOMER: 내 결제 QR
// -------------------------------------------------------
// ✔ /api/me/qr-token 으로 토큰 발급
// ✔ QRCode 생성 (qrcode)
// ✔ 3분마다 자동 갱신
// =======================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import QRCode from "qrcode";

export default function MyQrPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [token, setToken] = useState<string>("");
  const [imgUrl, setImgUrl] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  async function load() {
    setMsg("");
    try {
      const res = await fetch("/api/me/qr-token");
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message ?? "QR 생성 실패");
        return;
      }
      setToken(data.token);
    } catch {
      setMsg("네트워크 오류");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => load(), 150_000); // 2분 30초마다 갱신
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        // QR payload는 token만 넣어도 되지만, 스캐너쪽에서 식별하기 쉽게 prefix를 붙임
        const payload = `POINTQR:${token}`;
        const url = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
        setImgUrl(url);
      } catch {
        setMsg("QR 렌더 실패");
      }
    })();
  }, [token]);

  const short = useMemo(() => (token ? `${token.slice(0, 10)}...` : ""), [token]);

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>내 결제 QR</h1>
      <p style={{ opacity: 0.75, marginTop: 8 }}>
        제휴사에게 이 QR을 보여주세요. (토큰은 주기적으로 자동 갱신됩니다)
      </p>

      {msg && <p style={{ marginTop: 10, fontWeight: 900, color: "tomato" }}>{msg}</p>}

      <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 16, padding: 16 }}>
        {imgUrl ? (
          <div style={{ display: "grid", placeItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="QR" style={{ width: 320, height: 320 }} />
          </div>
        ) : (
          <div style={{ padding: 30, textAlign: "center", opacity: 0.7 }}>QR 생성 중...</div>
        )}

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          token: {short}
        </div>

        <button
          onClick={load}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          QR 새로고침
        </button>
      </div>
    </main>
  );
}
