"use client";

type Props = {
  phone: string;
  hasKakao: boolean;
};

export default function PhoneFloatingButton({ phone, hasKakao }: Props) {
  return (
    <a
      href={`tel:${phone}`}
      className="fixed right-5 z-40 flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg active:scale-95 transition-transform"
      style={{
        bottom: hasKakao ? "10rem" : "1.5rem",
        background: "oklch(0.55 0.18 145)",
      }}
      aria-label="전화상담"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
        <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/>
      </svg>
      <span className="text-[9px] font-black text-white mt-0.5 leading-none">전화상담</span>
    </a>
  );
}
