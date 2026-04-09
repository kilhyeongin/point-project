"use client";

import { useEffect, useRef, useState } from "react";

export default function ImageCarousel({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3500);
  }

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [images.length]);

  function goTo(index: number) {
    setCurrent(index);
    resetTimer();
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goTo((current + 1) % images.length);
      else goTo((current - 1 + images.length) % images.length);
    }
    touchStartX.current = null;
  }

  if (images.length === 0) {
    return (
      <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-muted-foreground text-sm font-semibold">
        이미지 없음
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-[4/3] bg-muted overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`이미지 ${i + 1}`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: i === current ? 1 : 0 }}
        />
      ))}

      {/* 도트 인디케이터 */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === current ? "20px" : "6px",
                height: "6px",
                background: i === current ? "white" : "rgba(255,255,255,0.5)",
              }}
            />
          ))}
        </div>
      )}

      {/* 이미지 수 뱃지 */}
      {images.length > 1 && (
        <div className="absolute top-3 right-3 z-10 bg-black/40 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {current + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
