"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PRESET_PARTNERS = [
  { businessName: "스타벅스 강남점", contactName: "김민준", address: "서울 강남구 테헤란로 1" },
  { businessName: "올리브영 홍대점", contactName: "이서연", address: "서울 마포구 홍익로 1" },
  { businessName: "CGV 영등포점", contactName: "박지훈", address: "서울 영등포구 영등포로 1" },
  { businessName: "롯데리아 신촌점", contactName: "최수아", address: "서울 서대문구 신촌로 1" },
  { businessName: "GS25 이태원점", contactName: "정도윤", address: "서울 용산구 이태원로 1" },
  { businessName: "뚜레쥬르 잠실점", contactName: "윤하은", address: "서울 송파구 잠실로 1" },
  { businessName: "맥도날드 명동점", contactName: "임재원", address: "서울 중구 명동길 1" },
  { businessName: "파리바게뜨 건대점", contactName: "강다은", address: "서울 광진구 능동로 1" },
];

type Form = {
  businessName: string;
  businessNumber: string;
  contactName: string;
  username: string;
  password: string;
  contactPhone: string;
  address: string;
};

function randomBizNum() {
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
}

function randomPhone() {
  const mid = String(Math.floor(Math.random() * 9000) + 1000);
  const end = String(Math.floor(Math.random() * 9000) + 1000);
  return `010${mid}${end}`;
}

function toUsername(name: string, idx: number) {
  const base = name.replace(/\s/g, "").toLowerCase().slice(0, 8);
  return `${base}${idx + 1}`;
}

export default function DevPartnerPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [form, setForm] = useState<Form>({
    businessName: "",
    businessNumber: "",
    contactName: "",
    username: "",
    password: "Test1234!",
    contactPhone: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ name: string; username: string; ok: boolean; msg: string }[]>([]);

  function set(key: keyof Form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function fillPreset(idx: number) {
    const p = PRESET_PARTNERS[idx % PRESET_PARTNERS.length];
    setForm({
      businessName: p.businessName,
      businessNumber: randomBizNum(),
      contactName: p.contactName,
      username: toUsername(p.businessName, idx),
      password: "Test1234!",
      contactPhone: randomPhone(),
      address: p.address,
    });
  }

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dev/create-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, organizationId: orgSlug }),
      });
      const data = await res.json();
      setResults(prev => [
        { name: form.businessName, username: form.username, ok: data.ok, msg: data.error ?? "생성 완료" },
        ...prev,
      ]);
      if (data.ok) {
        setForm(prev => ({ ...prev, businessName: "", businessNumber: "", contactName: "", username: "", contactPhone: "", address: "" }));
      }
    } catch {
      setResults(prev => [{ name: form.businessName, username: form.username, ok: false, msg: "네트워크 오류" }, ...prev]);
    } finally {
      setLoading(false);
    }
  }

  async function bulkCreate() {
    setLoading(true);
    for (let i = 0; i < PRESET_PARTNERS.length; i++) {
      const p = PRESET_PARTNERS[i];
      const body = {
        businessName: p.businessName,
        businessNumber: randomBizNum(),
        contactName: p.contactName,
        username: toUsername(p.businessName, i),
        password: "Test1234!",
        contactPhone: randomPhone(),
        address: p.address,
        organizationId: orgSlug,
      };
      try {
        const res = await fetch("/api/admin/dev/create-partner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setResults(prev => [
          { name: body.businessName, username: body.username, ok: data.ok, msg: data.error ?? "생성 완료" },
          ...prev,
        ]);
      } catch {
        setResults(prev => [{ name: body.businessName, username: body.username, ok: false, msg: "네트워크 오류" }, ...prev]);
      }
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-black text-foreground tracking-tight">테스트 제휴사 생성</h1>
        <p className="text-sm text-muted-foreground mt-1">테스트용 제휴사 계정을 빠르게 만듭니다. 기본 비밀번호: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">Test1234!</code></p>
      </div>

      {/* 프리셋 버튼 */}
      <div className="bg-card shadow-card rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground">프리셋 자동 채우기</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_PARTNERS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => fillPreset(i)}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors"
            >
              {p.businessName}
            </button>
          ))}
        </div>
        <Button type="button" onClick={bulkCreate} disabled={loading} className="w-full font-bold bg-emerald-500 hover:bg-emerald-600 text-white">
          {loading ? "생성 중..." : "8개 전체 한번에 생성"}
        </Button>
      </div>

      {/* 개별 생성 폼 */}
      <div className="bg-card shadow-card rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground">개별 생성</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-bold text-muted-foreground mb-1 block">업체명</label>
            <Input value={form.businessName} onChange={e => set("businessName", e.target.value)} placeholder="예: 스타벅스 강남점" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">사업자번호 (숫자 10자리)</label>
            <Input value={form.businessNumber} onChange={e => set("businessNumber", e.target.value)} placeholder="1234567890" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">담당자명</label>
            <Input value={form.contactName} onChange={e => set("contactName", e.target.value)} placeholder="홍길동" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">아이디</label>
            <Input value={form.username} onChange={e => set("username", e.target.value)} placeholder="partner01" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">비밀번호</label>
            <Input value={form.password} onChange={e => set("password", e.target.value)} placeholder="Test1234!" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">전화번호</label>
            <Input value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} placeholder="01012345678" className="h-10" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">주소</label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="서울 강남구 테헤란로 1" className="h-10" />
          </div>
        </div>
        <Button type="button" onClick={submit} disabled={loading} className="w-full font-bold">
          {loading ? "생성 중..." : "제휴사 생성"}
        </Button>
      </div>

      {/* 결과 */}
      {results.length > 0 && (
        <div className="bg-card shadow-card rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-muted-foreground">생성 결과</p>
          {results.map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm ${r.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
              <span className="font-bold">{r.name} <span className="font-normal opacity-60">({r.username})</span></span>
              <span className="text-xs">{r.ok ? "✓ " : "✗ "}{r.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
