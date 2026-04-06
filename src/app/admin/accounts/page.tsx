// src/app/admin/accounts/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AccountItem = {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  balance: number;
  socialProviders: string[];
};

type UserDetail = AccountItem & {
  email: string;
  createdAt: string;
  socialProviders: string[];
  customerProfile?: {
    phone: string;
    address: string;
    detailAddress: string;
    onboardingCompleted: boolean;
    interests: string[];
  } | null;
  partnerProfile?: {
    businessName: string;
    businessNumber: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    address: string;
    detailAddress: string;
    categories: string[];
    intro: string;
    benefitText: string;
    isPublished: boolean;
  } | null;
};

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function roleLabel(r: string) {
  if (r === "PARTNER") return "제휴사";
  if (r === "CUSTOMER") return "고객";
  if (r === "ADMIN") return "관리자";
  return r;
}

function statusLabel(s: string) {
  if (s === "ACTIVE") return "활성";
  if (s === "PENDING") return "대기";
  if (s === "BLOCKED") return "차단";
  return s;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE")
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-extrabold">
        {statusLabel(status)}
      </Badge>
    );
  if (status === "PENDING")
    return (
      <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-xs font-extrabold">
        {statusLabel(status)}
      </Badge>
    );
  if (status === "BLOCKED")
    return (
      <Badge className="bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-extrabold">
        {statusLabel(status)}
      </Badge>
    );
  return <Badge>{statusLabel(status)}</Badge>;
}

export default function AdminAccountsPage() {
  const [items, setItems] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "PARTNER" | "CUSTOMER" | "ADMIN">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const data = await res.json();
      if (data.ok) setDetail(data.user);
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  }

  // Admin creation form
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const load = useCallback(async (p: number, q: string, role: string) => {
    setLoading(true);
    setMsg("");

    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("q", q);
      if (role !== "ALL") params.set("role", role);

      const res = await fetch(`/api/admin/accounts?${params}`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setMsg(data?.message ?? "조회 실패");
        setItems([]);
        setLoading(false);
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch {
      setMsg("네트워크 오류");
      setItems([]);
    }

    setLoading(false);
  }, []);

  // 키워드/역할 변경 시 페이지 리셋 + 디바운스
  useEffect(() => {
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(1, keyword, roleFilter);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [keyword, roleFilter, load]);

  // 페이지 변경 시 즉시 로드
  useEffect(() => {
    load(page, keyword, roleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function handleStatusChange(id: string, newStatus: "ACTIVE" | "BLOCKED") {
    if (newStatus === "BLOCKED") {
      const target = items.find((it) => it.id === id);
      const name = target?.name || target?.username || "해당 계정";
      if (!window.confirm(`${name}을(를) 차단하시겠습니까?\n차단 시 해당 계정은 로그인이 제한됩니다.`)) return;
    }
    try {
      const res = await fetch(`/api/admin/users/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it))
        );
      } else {
        alert(data.message ?? "상태 변경 실패");
      }
    } catch {
      alert("네트워크 오류");
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          name: newName,
          password: newPassword,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setNewUsername("");
        setNewName("");
        setNewPassword("");
        setShowCreate(false);
        setMsg("관리자 계정이 생성되었습니다.");
        load(page, keyword, roleFilter);
      } else {
        setCreateMsg(data.message ?? "생성 실패");
      }
    } catch {
      setCreateMsg("네트워크 오류");
    }

    setCreating(false);
  }

  return (
    <main className="space-y-5">
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">계정 잔액</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              모든 계정의 포인트 잔액을 확인하고 계정 상태를 관리합니다.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setShowCreate(!showCreate); setCreateMsg(""); }}
          >
            관리자 추가
          </Button>
        </div>
      </section>

      {/* Admin creation form */}
      {showCreate && (
        <section className="bg-card shadow-card rounded-2xl p-5">
          <h2 className="text-base font-black text-foreground tracking-tight mb-4">관리자 계정 생성</h2>
          <form onSubmit={handleCreateAdmin} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="아이디 (4자 이상)"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
              <Input
                placeholder="이름"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="비밀번호 (8자 이상)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            {createMsg && (
              <p className="text-sm font-semibold text-destructive">{createMsg}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={creating}>
                {creating ? "생성 중..." : "생성"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowCreate(false); setCreateMsg(""); }}
              >
                취소
              </Button>
            </div>
          </form>
        </section>
      )}

      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="아이디 / 이름 검색"
          className="h-10"
        />
        <select
          value={roleFilter}
          onChange={(e) =>
            setRoleFilter(e.target.value as "ALL" | "PARTNER" | "CUSTOMER" | "ADMIN")
          }
          className="h-10 border border-border rounded-xl bg-background px-3 text-sm font-bold outline-none whitespace-nowrap"
        >
          <option value="ALL">전체 역할</option>
          <option value="PARTNER">제휴사</option>
          <option value="CUSTOMER">고객</option>
          <option value="ADMIN">관리자</option>
        </select>
        <Button type="button" onClick={() => load(page, keyword, roleFilter)}>
          새로고침
        </Button>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-semibold">
          {msg}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {loading ? "불러오는 중..." : `총 ${total.toLocaleString()}개 계정`}
      </p>

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block bg-card shadow-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[1.5fr_90px_80px_120px_120px] gap-2 px-4 py-2 text-xs font-bold text-muted-foreground border-b border-border bg-muted/30">
              <div>이름 / 아이디</div>
              <div>역할</div>
              <div>상태</div>
              <div className="text-right">잔액</div>
              <div className="text-right">관리</div>
            </div>

            {items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[1.5fr_90px_80px_120px_120px] gap-2 px-4 py-3 border-b border-border last:border-0 text-sm items-center"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openDetail(it.id)}
                      className="text-left font-bold text-foreground hover:text-primary hover:underline transition-colors"
                    >
                      {it.name}
                    </button>
                    {it.socialProviders.includes("naver") && (
                      <span className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-black text-white shrink-0" style={{ background: "#03C75A" }}>네이버</span>
                    )}
                    {it.socialProviders.includes("kakao") && (
                      <span className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-black shrink-0" style={{ background: "#FEE500", color: "#191919" }}>카카오</span>
                    )}
                  </div>
                  {!it.socialProviders.includes("naver") && !it.socialProviders.includes("kakao") && (
                    <div className="text-xs text-muted-foreground mt-0.5">{it.username}</div>
                  )}
                </div>
                <div>{roleLabel(it.role)}</div>
                <div>
                  <StatusBadge status={it.status} />
                </div>
                <div className="font-black text-right">{formatNumber(it.balance)}P</div>
                <div className="flex justify-end">
                  {it.role !== "ADMIN" && (
                    it.status === "BLOCKED" ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(it.id, "ACTIVE")}
                        className="text-xs font-bold px-2 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      >
                        차단해제
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(it.id, "BLOCKED")}
                        className="text-xs font-bold px-2 py-1 rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        차단
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}

            {!loading && items.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                조회 결과가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 카드 목록 */}
      <div className="flex md:hidden flex-col gap-3">
        {items.map((it) => (
          <div key={it.id} className="bg-card shadow-card rounded-2xl p-4">
            <div className="flex justify-between items-start gap-3 mb-3">
              <button
                type="button"
                onClick={() => openDetail(it.id)}
                className="text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-foreground hover:text-primary hover:underline transition-colors">{it.name}</span>
                  {it.socialProviders.includes("naver") && (
                    <span className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-black text-white shrink-0" style={{ background: "#03C75A" }}>네이버</span>
                  )}
                  {it.socialProviders.includes("kakao") && (
                    <span className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-black shrink-0" style={{ background: "#FEE500", color: "#191919" }}>카카오</span>
                  )}
                </div>
                {!it.socialProviders.includes("naver") && !it.socialProviders.includes("kakao") && (
                  <div className="text-sm text-muted-foreground mt-1">{it.username}</div>
                )}
              </button>
              <div className="text-lg font-black text-foreground whitespace-nowrap">
                {formatNumber(it.balance)}P
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">역할</span>
                <span>{roleLabel(it.role)}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">상태</span>
                <StatusBadge status={it.status} />
              </div>
              {it.role !== "ADMIN" && (
                <div className="flex justify-end pt-1">
                  {it.status === "BLOCKED" ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(it.id, "ACTIVE")}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                      차단 해제
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(it.id, "BLOCKED")}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      차단
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            조회 결과가 없습니다.
          </div>
        )}
      </div>
      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-bold border border-border transition-colors",
              page <= 1 || loading
                ? "text-muted-foreground bg-muted cursor-not-allowed"
                : "text-foreground bg-card hover:bg-muted"
            )}
          >
            이전
          </button>
          <span className="text-sm font-semibold text-foreground px-2">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-bold border border-border transition-colors",
              page >= totalPages || loading
                ? "text-muted-foreground bg-muted cursor-not-allowed"
                : "text-foreground bg-card hover:bg-muted"
            )}
          >
            다음
          </button>
        </div>
      )}

      {/* 상세 모달 */}
      {(detailLoading || detail) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => { setDetail(null); setDetailLoading(false); }}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : detail ? (
              <div className="p-6 space-y-5">
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-foreground">{detail.name}</span>
                      {detail.socialProviders.includes("naver") && (
                        <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-black text-white shrink-0" style={{ background: "#03C75A" }}>네이버</span>
                      )}
                      {detail.socialProviders.includes("kakao") && (
                        <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-black shrink-0" style={{ background: "#FEE500", color: "#191919" }}>카카오</span>
                      )}
                    </div>
                    {!detail.socialProviders.includes("naver") && !detail.socialProviders.includes("kakao") && (
                      <div className="text-sm text-muted-foreground mt-1">@{detail.username}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="text-muted-foreground hover:text-foreground text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* 기본 정보 */}
                <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
                  <div className="font-bold text-foreground mb-2">기본 정보</div>
                  <Row label="역할" value={roleLabel(detail.role)} />
                  <Row label="상태" value={<StatusBadge status={detail.status} />} />
                  <Row label="이메일" value={detail.email || "-"} />
                  <Row label="잔액" value={`${formatNumber(detail.balance)}P`} />
                  <Row label="가입일" value={detail.createdAt ? new Date(detail.createdAt).toLocaleDateString("ko-KR") : "-"} />
                </div>

                {/* 고객 프로필 */}
                {detail.role === "CUSTOMER" && detail.customerProfile && (
                  <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
                    <div className="font-bold text-foreground mb-2">고객 프로필</div>
                    <Row label="연락처" value={detail.customerProfile.phone || "-"} />
                    <Row label="주소" value={[detail.customerProfile.address, detail.customerProfile.detailAddress].filter(Boolean).join(" ") || "-"} />
                    <Row label="온보딩" value={detail.customerProfile.onboardingCompleted ? "완료" : "미완료"} />
                    <Row label="관심 카테고리" value={detail.customerProfile.interests?.length ? detail.customerProfile.interests.join(", ") : "-"} />
                  </div>
                )}

                {/* 파트너 프로필 */}
                {detail.role === "PARTNER" && detail.partnerProfile && (
                  <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
                    <div className="font-bold text-foreground mb-2">파트너 프로필</div>
                    <Row label="상호명" value={detail.partnerProfile.businessName || "-"} />
                    <Row label="사업자번호" value={detail.partnerProfile.businessNumber || "-"} />
                    <Row label="담당자" value={detail.partnerProfile.contactName || "-"} />
                    <Row label="담당자 연락처" value={detail.partnerProfile.contactPhone || "-"} />
                    <Row label="담당자 이메일" value={detail.partnerProfile.contactEmail || "-"} />
                    <Row label="주소" value={[detail.partnerProfile.address, detail.partnerProfile.detailAddress].filter(Boolean).join(" ") || "-"} />
                    <Row label="카테고리" value={detail.partnerProfile.categories?.length ? detail.partnerProfile.categories.join(", ") : "-"} />
                    <Row label="소개글" value={detail.partnerProfile.intro || "-"} />
                    <Row label="혜택 안내" value={detail.partnerProfile.benefitText || "-"} />
                    <Row label="프로필 공개" value={detail.partnerProfile.isPublished ? "공개" : "비공개"} />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-muted-foreground shrink-0 w-28">{label}</span>
      <span className="font-semibold text-foreground break-all">{value}</span>
    </div>
  );
}
