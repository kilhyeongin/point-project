"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: "10px 28px",
        borderRadius: 8,
        border: "none",
        background: "#111",
        color: "#fff",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      🖨️ 인쇄 / PDF 저장
    </button>
  );
}
