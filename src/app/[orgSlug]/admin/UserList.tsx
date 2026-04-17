"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn, formatUsername } from "@/lib/utils";

type Role = "CUSTOMER" | "PARTNER" | "ADMIN";
type Status = "ACTIVE" | "PENDING" | "BLOCKED";

type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
  status: Status;
  createdAt: string;
  balance: number;
};

const ROLE_LABEL: Record<Role, string> = { CUSTOMER: "고객", PARTNER: "제휴사", ADMIN: "총괄관리자" };
const STATUS_LABEL: Record<Status, string> = { ACTIVE: "활성", PENDING: "대기", BLOCKED: "차단" };

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function formatKrDateTime(v: string) {
  if (!v) return "-";
  const d = new Date(v);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${yy}.${mm}.${dd} ${ampm}${h12}시${min}분`;
}

export default function UserList({
  users,
  updateUserRole,
}: {
  users: User[];
  updateUserRole: (formData: FormData) => Promise<void>;
}) {
  const [visibleCount, setVisibleCount] = useState(3);
  const visible = users.slice(0, visibleCount);
  const hasMore = visibleCount < users.length;

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-xl shadow-card">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[180px_140px_100px_100px_220px_120px_160px] gap-3 items-center px-4 py-3 bg-muted/50 border-b border-border text-xs font-black text-muted-foreground uppercase tracking-wide">
            <div>아이디</div>
            <div>이름</div>
            <div>역할</div>
            <div>상태</div>
            <div>역할 변경</div>
            <div>잔액</div>
            <div>가입일</div>
          </div>

          {visible.length > 0 ? (
            visible.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-[180px_140px_100px_100px_220px_120px_160px] gap-3 items-center px-4 py-3.5 border-b border-border last:border-0 text-sm hover:bg-muted/30 transition-colors"
              >
                <div className="truncate font-medium text-foreground">{formatUsername(u.username)}</div>
                <div className="truncate text-foreground">{u.name}</div>
                <div>
                  <Badge variant="outline" className={cn("text-xs font-bold",
                    u.role === "ADMIN" && "bg-amber-50 text-amber-700 border-amber-200",
                    u.role === "PARTNER" && "bg-blue-50 text-blue-700 border-blue-200",
                    u.role === "CUSTOMER" && "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}>
                    {ROLE_LABEL[u.role]}
                  </Badge>
                </div>
                <div>
                  <Badge variant="outline" className={cn("text-xs font-bold",
                    u.status === "ACTIVE" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    u.status === "PENDING" && "bg-yellow-50 text-yellow-700 border-yellow-200",
                    u.status === "BLOCKED" && "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {STATUS_LABEL[u.status]}
                  </Badge>
                </div>
                <div>
                  {u.role === "ADMIN" ? (
                    <span className="text-xs text-muted-foreground font-semibold">변경 불가</span>
                  ) : (
                    <form action={updateUserRole} className="flex gap-2 items-center">
                      <input type="hidden" name="userId" value={u.id} />
                      <select name="role" defaultValue={u.role} className="h-9 rounded-lg border border-border bg-background px-2 text-sm font-semibold text-foreground outline-none focus:border-primary">
                        <option value="CUSTOMER">고객</option>
                        <option value="PARTNER">제휴사</option>
                      </select>
                      <button type="submit" className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-bold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">
                        적용
                      </button>
                    </form>
                  )}
                </div>
                <div className="font-black text-foreground">{formatNumber(u.balance)}P</div>
                <div className="text-xs text-muted-foreground truncate">{formatKrDateTime(u.createdAt)}</div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">사용자가 없습니다.</div>
          )}
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {visible.length > 0 ? (
          visible.map((u) => (
            <div key={u.id} className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-black text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatUsername(u.username)}</p>
                </div>
                <p className="text-lg font-black text-foreground whitespace-nowrap shrink-0">{formatNumber(u.balance)}P</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" className={cn("text-xs font-bold",
                  u.role === "ADMIN" && "bg-amber-50 text-amber-700 border-amber-200",
                  u.role === "PARTNER" && "bg-blue-50 text-blue-700 border-blue-200",
                  u.role === "CUSTOMER" && "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}>{ROLE_LABEL[u.role]}</Badge>
                <Badge variant="outline" className={cn("text-xs font-bold",
                  u.status === "ACTIVE" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                  u.status === "PENDING" && "bg-yellow-50 text-yellow-700 border-yellow-200",
                  u.status === "BLOCKED" && "bg-red-50 text-red-700 border-red-200"
                )}>{STATUS_LABEL[u.status]}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">가입일 {formatKrDateTime(u.createdAt)}</div>
              {u.role !== "ADMIN" && (
                <form action={updateUserRole} className="mt-3 flex gap-2 flex-wrap">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="role" defaultValue={u.role} className="flex-1 min-w-[120px] h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-primary">
                    <option value="CUSTOMER">고객</option>
                    <option value="PARTNER">제휴사</option>
                  </select>
                  <button type="submit" className="h-9 px-4 rounded-lg border border-border bg-background text-sm font-bold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">
                    적용
                  </button>
                </form>
              )}
            </div>
          ))
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">사용자가 없습니다.</div>
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + 3)}
          className="mt-3 w-full py-2 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border transition-colors"
        >
          더보기 ({users.length - visibleCount}명 남음)
        </button>
      )}
    </>
  );
}
