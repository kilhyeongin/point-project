// src/app/customer/FavoritePartnerButton.tsx
"use client";

import { useEffect, useState } from "react";

type Props = {
  partnerId: string;
  initialFavorite: boolean;
  onChange?: (next: boolean) => void;
  onChanged?: (next: boolean) => void;
};

type ToggleResponse = {
  ok: boolean;
  isFavorite?: boolean;
  message?: string;
  error?: string;
};

export default function FavoritePartnerButton({
  partnerId,
  initialFavorite,
  onChange,
  onChanged,
}: Props) {
  const [favorite, setFavorite] = useState(Boolean(initialFavorite));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFavorite(Boolean(initialFavorite));
  }, [initialFavorite]);

  async function toggleFavorite() {
    if (loading) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/customer/favorites/${partnerId}`, {
        method: favorite ? "DELETE" : "POST",
      });

      const data: ToggleResponse = await res.json();

      if (!res.ok || !data?.ok) {
        return;
      }

      const next = Boolean(data.isFavorite);
      setFavorite(next);

      onChange?.(next);
      onChanged?.(next);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={loading}
      aria-pressed={favorite}
      title={favorite ? "관심업체 저장됨" : "관심업체 저장"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "none",
        background: "transparent",
        cursor: loading ? "not-allowed" : "pointer",
        padding: 0,
        transition: "transform 0.15s ease",
        opacity: loading ? 0.5 : 1,
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill={favorite ? "#f59e0b" : "none"}
        stroke={favorite ? "#f59e0b" : "#9ca3af"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: "fill 0.2s ease, stroke 0.2s ease",
        }}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
