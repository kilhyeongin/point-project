"use client";

type Props = {
  url: string;
};

export default function KakaoFloatingButton({ url }: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-24 right-5 z-40 flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg active:scale-95 transition-transform"
      style={{ background: "#FEE500" }}
      aria-label="카카오 상담하기"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.552 1.515 4.797 3.813 6.18-.168.63-.607 2.285-.695 2.64-.109.427.156.42.33.306.135-.089 2.145-1.457 3.012-2.044A11.3 11.3 0 0 0 12 18c5.523 0 10-3.477 10-7.5S17.523 3 12 3z"/>
      </svg>
      <span className="text-[9px] font-black text-[#3A1D1D] mt-0.5 leading-none">상담하기</span>
    </a>
  );
}
