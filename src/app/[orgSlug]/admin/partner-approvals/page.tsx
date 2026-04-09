"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatUsername } from "@/lib/utils";

type ApprovalItem = {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  createdAt?: string;
  partnerProfile?: {
    businessName?: string;
    contactName?: string;
    contactPhone?: string;
    address?: string;
    detailAddress?: string;
  };
};

function formatDate(value?: string) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("ko-KR");
}

export default function AdminPartnerApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/partner-approvals", {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setMsg(data?.message ?? data?.error ?? "승인대기 제휴사 목록을 불러오지 못했습니다.");
        setItems([]);
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setMsg("네트워크 오류가 발생했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function approvePartner(userId: string) {
    const ok = window.confirm("이 제휴사 계정을 승인할까요?");
    if (!ok) return;

    setApprovingId(userId);
    setMsg("");

    try {
      const res = await fetch("/api/admin/users/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        window.alert(data?.error ?? "승인 처리에 실패했습니다.");
        return;
      }

      window.alert(data?.message ?? "승인되었습니다.");
      await load();
    } catch {
      window.alert("네트워크 오류가 발생했습니다.");
    } finally {
      setApprovingId("");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const businessName = String(item.partnerProfile?.businessName ?? "").toLowerCase();
      const contactName = String(item.partnerProfile?.contactName ?? "").toLowerCase();
      const username = String(item.username ?? "").toLowerCase();
      const name = String(item.name ?? "").toLowerCase();
      const phone = String(item.partnerProfile?.contactPhone ?? "").toLowerCase();
      const address = String(item.partnerProfile?.address ?? "").toLowerCase();

      return (
        businessName.includes(q) ||
        contactName.includes(q) ||
        username.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        address.includes(q)
      );
    });
  }, [items, keyword]);

  return (
    <main className="space-y-5">
      <section className="bg-card shadow-card rounded-2xl p-5 flex justify-between items-start gap-4 flex-wrap">
        <div>
          <div className="text-xs font-extrabold text-muted-foreground mb-2">총괄관리자</div>
          <h1 className="text-xl font-black text-foreground tracking-tight">제휴사 승인</h1>
          <p className="mt-2 text-muted-foreground leading-relaxed text-sm">
            가입 후 승인대기 상태로 등록된 제휴사 계정을 확인하고 승인할 수 있습니다.
          </p>
        </div>

        <div className="bg-muted/50 rounded-xl p-4 text-center min-w-[160px]">
          <div className="text-xs text-muted-foreground mt-1">승인대기 제휴사</div>
          <div className="text-2xl font-black text-foreground">
            {loading ? "-" : `${filteredItems.length}개`}
          </div>
        </div>
      </section>

      <section className="bg-card shadow-card rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="업체명 / 담당자명 / 아이디 / 전화번호 / 주소 검색"
            className="h-10"
          />
          <Button type="button" onClick={load}>
            새로고침
          </Button>
        </div>

        {msg ? (
          <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
            {msg}
          </div>
        ) : null}

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            승인대기 중인 제휴사가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
            {filteredItems.map((item) => {
              const businessName =
                String(item.partnerProfile?.businessName ?? "").trim() ||
                item.name ||
                "-";

              const contactName =
                String(item.partnerProfile?.contactName ?? "").trim() || "-";

              const contactPhone =
                String(item.partnerProfile?.contactPhone ?? "").trim() || "-";

              const address =
                [item.partnerProfile?.address, item.partnerProfile?.detailAddress]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || "-";

              return (
                <article
                  key={item.id}
                  className="bg-card shadow-card rounded-2xl p-5 space-y-4"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="text-lg font-black text-foreground">{businessName}</div>
                      <div className="mt-1 text-muted-foreground font-bold text-xs">
                        아이디: {formatUsername(item.username)}
                      </div>
                    </div>
                    <Badge className="bg-orange-50 text-orange-800 border border-orange-200 rounded-full text-xs font-extrabold whitespace-nowrap">
                      승인대기
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <InfoRow label="담당자명" value={contactName} />
                    <InfoRow label="연락처" value={contactPhone} />
                    <InfoRow label="주소" value={address} />
                    <InfoRow label="가입일시" value={formatDate(item.createdAt)} />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => approvePartner(item.id)}
                      disabled={approvingId === item.id}
                    >
                      {approvingId === item.id ? "처리 중..." : "승인"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-3 bg-muted/50">
      <div className="text-xs font-extrabold text-muted-foreground mb-1">{label}</div>
      <div className="text-foreground leading-relaxed break-words text-sm">{value}</div>
    </div>
  );
}
