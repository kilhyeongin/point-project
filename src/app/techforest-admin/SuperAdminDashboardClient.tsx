"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, Plus, Building2, Users, UserCheck, UserCircle,
  ToggleLeft, ToggleRight, LogOut, Loader2, ChevronDown, ChevronUp, X, Eye, EyeOff,
} from "lucide-react";

type SessionInfo = { uid: string; username: string; name: string; role: string };

type OrgItem = {
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  adminCount: number;
  partnerCount: number;
  customerCount: number;
};

function formatDate(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function SuperAdminDashboardClient({ session }: { session: SessionInfo }) {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/techforest-admin/organizations", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setOrgs(data.organizations ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  async function toggleActive(org: OrgItem) {
    setTogglingSlug(org.slug);
    try {
      await fetch(`/api/techforest-admin/organizations/${org.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !org.isActive }),
      });
      setOrgs((prev) =>
        prev.map((o) => o.slug === org.slug ? { ...o, isActive: !org.isActive } : o)
      );
    } finally {
      setTogglingSlug(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/techforest-admin/login";
  }

  const totalPartners = orgs.reduce((s, o) => s + o.partnerCount, 0);
  const totalCustomers = orgs.reduce((s, o) => s + o.customerCount, 0);
  const activeOrgs = orgs.filter((o) => o.isActive).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-sm text-white tracking-tight">Super Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold hidden sm:block">{session.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "전체 조직", value: orgs.length, icon: Building2, color: "text-violet-400" },
            { label: "활성 조직", value: activeOrgs, icon: ToggleRight, color: "text-emerald-400" },
            { label: "전체 제휴사", value: totalPartners, icon: UserCheck, color: "text-blue-400" },
            { label: "전체 고객", value: totalCustomers, icon: UserCircle, color: "text-amber-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
              <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
              <p className="text-2xl font-black text-white">{loading ? "—" : stat.value.toLocaleString()}</p>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* 조직 목록 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white">조직 목록</h2>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition-all shadow-lg shadow-violet-900/30"
          >
            <Plus className="w-3.5 h-3.5" />
            새 조직 생성
          </button>
        </div>

        {/* 조직 생성 폼 */}
        {showCreate && (
          <CreateOrgForm
            onCreated={() => { fetchOrgs(); setShowCreate(false); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* 조직 리스트 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-sm font-bold text-slate-400">등록된 조직이 없습니다</p>
            <p className="text-xs text-slate-600 mt-1">새 조직 생성 버튼을 눌러 시작하세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orgs.map((org) => (
              <div
                key={org.slug}
                className={`bg-slate-800/60 border rounded-2xl p-4 transition-all ${
                  org.isActive ? "border-slate-700/50" : "border-slate-800 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-white">{org.name}</span>
                      <span className="text-xs font-bold text-slate-500 font-mono bg-slate-700/50 px-2 py-0.5 rounded-md">
                        /{org.slug}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        org.isActive
                          ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/30"
                          : "bg-slate-700/40 text-slate-500 border border-slate-600/30"
                      }`}>
                        {org.isActive ? "활성" : "비활성"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Users className="w-3 h-3" />
                        관리자 {org.adminCount}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <UserCheck className="w-3 h-3" />
                        제휴사 {org.partnerCount}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <UserCircle className="w-3 h-3" />
                        고객 {org.customerCount}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">생성일 {formatDate(org.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/${org.slug}/login`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      접속
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleActive(org)}
                      disabled={togglingSlug === org.slug}
                      className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-40"
                    >
                      {togglingSlug === org.slug ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : org.isActive ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── 조직 생성 폼 ─────────────────────────────────────────
function CreateOrgForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    adminUsername: "",
    adminPassword: "",
    adminName: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ loginUrl: string; username: string } | null>(null);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/techforest-admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.ok) {
        setResult({ loginUrl: data.loginUrl, username: data.admin.username });
        onCreated();
      } else {
        setError(data.error ?? "생성에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-800/80 border border-violet-700/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-white">새 조직 생성</h3>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <UserCheck className="w-4 h-4" />
            <span className="text-sm font-black">조직이 생성되었습니다!</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4 space-y-2 text-sm">
            <p className="text-slate-400">관리자 아이디: <span className="text-white font-bold font-mono">{result.username}</span></p>
            <p className="text-slate-400">로그인 URL: <a href={result.loginUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 font-bold underline">{result.loginUrl}</a></p>
          </div>
          <button type="button" onClick={onCancel} className="w-full h-10 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition-all">
            닫기
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="조직 이름 *" value={form.name} onChange={(v) => set("name", v)} placeholder="예: ABC 회사" />
            <Field label="Slug (URL 식별자)" value={form.slug} onChange={(v) => set("slug", v)} placeholder="자동 생성 (비워두면 됨)" />
            <Field label="관리자 아이디 *" value={form.adminUsername} onChange={(v) => set("adminUsername", v)} placeholder="4자 이상, 영문/숫자" />
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">관리자 비밀번호 *</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.adminPassword}
                  onChange={(e) => set("adminPassword", e.target.value)}
                  placeholder="8자 이상"
                  className="w-full h-10 px-3 pr-9 rounded-xl bg-slate-900/60 border border-slate-600/50 text-white placeholder-slate-600 text-sm font-semibold focus:outline-none focus:border-violet-500 transition-all"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <Field label="관리자 이름" value={form.adminName} onChange={(v) => set("adminName", v)} placeholder="비워두면 자동 설정" />
          </div>

          {error && (
            <div className="rounded-xl bg-red-900/30 border border-red-700/40 px-4 py-3">
              <p className="text-sm font-bold text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition-all">
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !form.name || !form.adminUsername || !form.adminPassword}
              className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black transition-all"
            >
              {loading ? "생성 중..." : "조직 생성"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-xl bg-slate-900/60 border border-slate-600/50 text-white placeholder-slate-600 text-sm font-semibold focus:outline-none focus:border-violet-500 transition-all"
      />
    </div>
  );
}
