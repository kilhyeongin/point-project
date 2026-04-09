"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Lock, Star, User } from "lucide-react";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import InterestsSettingForm from "./InterestsSettingForm";

type Profile = {
  name: string;
  email: string;
  phone: string;
  address: string;
  detailAddress: string;
  socialProvider?: string | null;
};

export default function CustomerMyPageClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Omit<Profile, "name">>({
    email: "",
    phone: "",
    address: "",
    detailAddress: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showInterests, setShowInterests] = useState(false);

  useEffect(() => {
    fetch("/api/customer/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.profile) {
          setProfile(data.profile);
          setForm({
            email: data.profile.email ?? "",
            phone: data.profile.phone ?? "",
            address: data.profile.address ?? "",
            detailAddress: data.profile.detailAddress ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setSaveMsg({ text: data?.message ?? "저장하지 못했습니다.", ok: false });
      } else {
        setSaveMsg({ text: "저장되었습니다.", ok: true });
      }
    } catch {
      setSaveMsg({ text: "네트워크 오류가 발생했습니다.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 개인정보 */}
      <section className="bg-card shadow-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
          <User className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-black text-foreground">개인정보</h2>
        </div>
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-11 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {/* 이름 (읽기 전용) */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                  이름 <span className="text-muted-foreground/60 font-normal">(변경 불가)</span>
                </label>
                <Input
                  value={profile?.name ?? ""}
                  readOnly
                  className="bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">이메일</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setSaveMsg(null); }}
                  placeholder="이메일 주소 입력"
                />
              </div>

              {/* 전화번호 */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">전화번호</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => { setForm((p) => ({ ...p, phone: e.target.value })); setSaveMsg(null); }}
                  placeholder="010-0000-0000"
                />
              </div>

              {/* 주소 */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">주소</label>
                <Input
                  value={form.address}
                  onChange={(e) => { setForm((p) => ({ ...p, address: e.target.value })); setSaveMsg(null); }}
                  placeholder="주소 입력"
                  className="mb-2"
                />
                <Input
                  value={form.detailAddress}
                  onChange={(e) => { setForm((p) => ({ ...p, detailAddress: e.target.value })); setSaveMsg(null); }}
                  placeholder="상세 주소 입력"
                />
              </div>

              {saveMsg && (
                <div
                  className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
                    saveMsg.ok
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-destructive/8 border-destructive/20 text-destructive"
                  }`}
                >
                  {saveMsg.text}
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full h-11 rounded-xl text-sm font-black text-white transition-all disabled:opacity-40 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, oklch(0.52 0.27 264) 0%, oklch(0.44 0.24 280) 100%)" }}
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </>
          )}
        </div>
      </section>

      {/* 비밀번호 변경 - 소셜 가입자 제외 */}
      {!profile?.socialProvider && <section className="bg-card shadow-card rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="w-full flex items-center justify-between gap-2.5 px-5 py-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-primary" />
            <span className="text-sm font-black text-foreground">비밀번호 변경</span>
          </div>
          {showPassword ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {showPassword && (
          <div className="px-5 pb-5 border-t border-border pt-4">
            <ChangePasswordForm />
          </div>
        )}
      </section>}

      {/* 관심사 설정 */}
      <section className="bg-card shadow-card rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowInterests((v) => !v)}
          className="w-full flex items-center justify-between gap-2.5 px-5 py-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm font-black text-foreground">관심사 설정</span>
          </div>
          {showInterests ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {showInterests && (
          <div className="px-5 pb-5 border-t border-border pt-4">
            <InterestsSettingForm />
          </div>
        )}
      </section>
    </div>
  );
}
