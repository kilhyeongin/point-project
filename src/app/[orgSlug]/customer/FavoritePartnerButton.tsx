// src/app/[orgSlug]/customer/FavoritePartnerButton.tsx
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
        width: 28,
        height: 28,
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
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={favorite ? "#ef4444" : "none"}
        stroke={favorite ? "#ef4444" : "#9ca3af"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: "fill 0.2s ease, stroke 0.2s ease",
        }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
