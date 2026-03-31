"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChangePasswordForm() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setMsg({ text: "새 비밀번호가 일치하지 않습니다.", ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.message ?? "변경 실패", ok: false });
      } else {
        setMsg({ text: data.message ?? "비밀번호가 변경되었습니다.", ok: true });
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch {
      setMsg({ text: "네트워크 오류", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-foreground mb-1.5">
          현재 비밀번호
        </label>
        <Input
          type="password"
          value={form.currentPassword}
          onChange={(e) => update("currentPassword", e.target.value)}
          placeholder="현재 비밀번호 입력"
          autoComplete="current-password"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-foreground mb-1.5">
          새 비밀번호
        </label>
        <Input
          type="password"
          value={form.newPassword}
          onChange={(e) => update("newPassword", e.target.value)}
          placeholder="새 비밀번호 (8자 이상)"
          autoComplete="new-password"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-foreground mb-1.5">
          새 비밀번호 확인
        </label>
        <Input
          type="password"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          placeholder="새 비밀번호 다시 입력"
          autoComplete="new-password"
          required
        />
      </div>

      {msg && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
            msg.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-destructive/8 border-destructive/20 text-destructive"
          }`}
        >
          {msg.text}
        </div>
      )}

      <Button type="submit" disabled={saving} className="w-full h-11 font-bold">
        {saving ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}
