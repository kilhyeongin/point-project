"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus, Users } from "lucide-react";

type Staff = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  referralCount: number;
  createdAt: string;
};

export default function PartnerStaffPage() {
  const pathname = usePathname();
  const orgSlug = pathname.split("/")[1];

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const baseSignupUrl = `${origin}/${orgSlug}/signup/customer`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/staff");
      const data = await res.json();
      if (data.ok) setStaff(data.staff);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addStaff() {
    if (!newName.trim()) {
      toast.error("직원 이름을 입력해 주세요.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/partner/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error ?? "직원 등록에 실패했습니다.");
        return;
      }
      setStaff((prev) => [...prev, data.staff]);
      setNewName("");
      toast.success(`${data.staff.name} 직원이 등록되었습니다.`);
    } finally {
      setAdding(false);
    }
  }

  async function removeStaff(id: string, name: string) {
    if (!confirm(`${name} 직원을 삭제하시겠습니까?\n기존 추천 가입자 기록은 유지됩니다.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/partner/staff/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error ?? "삭제에 실패했습니다.");
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== id));
      toast.success("직원이 삭제되었습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  function copyLink(code: string) {
    const url = `${baseSignupUrl}?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("추천 링크가 복사되었습니다.");
    });
  }

  const activeStaff = staff.filter((s) => s.isActive);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">직원 관리</h1>
        <p className="text-muted-foreground text-sm mt-1">
          직원별 추천 링크를 발급하고 가입자 수를 확인합니다.
        </p>
      </div>

      {/* 직원 추가 */}
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-3">
        <p className="text-sm font-bold text-foreground">직원 추가</p>
        <div className="flex gap-2">
          <Input
            placeholder="직원 이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStaff()}
            className="h-11"
          />
          <Button onClick={addStaff} disabled={adding} className="h-11 px-5 font-bold shrink-0">
            <UserPlus className="w-4 h-4 mr-1.5" />
            {adding ? "등록 중..." : "추가"}
          </Button>
        </div>
      </div>

      {/* 직원 목록 */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="font-bold text-sm">직원 목록</span>
          <span className="ml-auto text-xs text-muted-foreground">{activeStaff.length}명</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">불러오는 중...</div>
        ) : activeStaff.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">
            등록된 직원이 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {activeStaff.map((s) => (
              <li key={s.id} className="px-5 py-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{s.name}</span>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-md text-muted-foreground">
                      {s.code}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    추천 가입자 <span className="font-bold text-foreground">{s.referralCount}명</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(s.code)}
                    className="h-8 px-3 text-xs font-bold"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    링크 복사
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStaff(s.id, s.name)}
                    disabled={deletingId === s.id}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
