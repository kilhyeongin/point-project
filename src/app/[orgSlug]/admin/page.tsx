// src/app/[orgSlug]/admin/page.tsx
// =======================================================
// ADMIN DASHBOARD
// -------------------------------------------------------
// - ADMIN 전용
// - 반응형(모바일/태블릿/PC)
// - 운영 KPI
// - 승인 대기 / 빠른 실행
// - 최근 원장 활동 / TOP 사용처
// - 사용자 관리 (PC 테이블 / 모바일 카드)
// =======================================================

import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { User } from "@/models/User";
import { Ledger } from "@/models/Ledger";
import { TopupRequest } from "@/models/TopupRequest";
import { IssueRequest } from "@/models/IssueRequest";
import { UseRequest } from "@/models/UseRequest";
import { Badge } from "@/components/ui/badge";
import { cn, formatUsername } from "@/lib/utils";

type Role = "CUSTOMER" | "PARTNER" | "ADMIN";
type Status = "ACTIVE" | "PENDING" | "BLOCKED";

const LEDGER_TYPE_LABEL = {
  TOPUP: "충전",
  ISSUE: "지급",
  USE: "사용",
  ADJUST: "조정",
} as const;

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "고객",
  PARTNER: "제휴사",
  ADMIN: "총괄관리자",
};

const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: "활성",
  PENDING: "대기",
  BLOCKED: "차단",
};

type SearchParams = Promise<{ role?: string; q?: string }>;

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

function formatKrDateTime(v: unknown) {
  if (!v) return "-";
  const d = new Date(v as string);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${yy}.${mm}.${dd} ${ampm}${h12}시${min}분`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export default async function AdminDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: SearchParams;
}) {
  const { orgSlug } = await params;
  const session = await getSessionFromCookies();
  if (!session) redirect(`/${orgSlug}/login`);
  if (session.role !== "ADMIN") redirect(`/${orgSlug}/admin`);

  const sp = searchParams ? await searchParams : undefined;
  const roleParam = String(sp?.role ?? "ALL").toUpperCase();
  const q = String(sp?.q ?? "").trim();

  const activeRole: "ALL" | Role =
    roleParam === "CUSTOMER" ||
    roleParam === "PARTNER" ||
    roleParam === "ADMIN"
      ? (roleParam as Role)
      : "ALL";

  await connectDB();

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const orgId = session.orgId ?? "default";

  const [
    pendingTopupCount,
    pendingIssueCount,
    pendingUseCount,
    totalUsers,
    customerCount,
    partnerCount,
  ] = await Promise.all([
    TopupRequest.countDocuments({ organizationId: orgId, status: "PENDING" }),
    IssueRequest.countDocuments({ organizationId: orgId, status: "PENDING" }),
    UseRequest.countDocuments({ organizationId: orgId, status: "PENDING" }),
    User.countDocuments({ organizationId: orgId }),
    User.countDocuments({ organizationId: orgId, role: "CUSTOMER" }),
    User.countDocuments({ organizationId: orgId, role: "PARTNER" }),
  ]);

  const [todayLedgerRows, monthLedgerRows] = await Promise.all([
    Ledger.aggregate([
      {
        $match: {
          organizationId: orgId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          amount: { $sum: { $abs: "$amount" } },
        },
      },
    ]),
    Ledger.aggregate([
      {
        $match: {
          organizationId: orgId,
          createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          amount: { $sum: { $abs: "$amount" } },
        },
      },
    ]),
  ]);

  const todayMap = new Map<string, { count: number; amount: number }>();
  for (const row of todayLedgerRows) {
    todayMap.set(String(row._id), {
      count: Number(row.count ?? 0),
      amount: Number(row.amount ?? 0),
    });
  }

  const monthMap = new Map<string, { count: number; amount: number }>();
  for (const row of monthLedgerRows) {
    monthMap.set(String(row._id), {
      count: Number(row.count ?? 0),
      amount: Number(row.amount ?? 0),
    });
  }

  const todayIssueAmount = todayMap.get("ISSUE")?.amount ?? 0;
  const todayUseAmount = todayMap.get("USE")?.amount ?? 0;
  const monthUseCount = monthMap.get("USE")?.count ?? 0;
  const monthUsedPoints = monthMap.get("USE")?.amount ?? 0;

  const monthExpectedPayout = monthUsedPoints;

  const topCounterpartiesRaw = await Ledger.aggregate([
    {
      $match: {
        organizationId: orgId,
        type: "USE",
        counterpartyId: { $ne: null },
        createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
      },
    },
    {
      $group: {
        _id: "$counterpartyId",
        useCount: { $sum: 1 },
        usedPoints: { $sum: { $abs: "$amount" } },
      },
    },
    { $sort: { usedPoints: -1 } },
    { $limit: 5 },
  ]);

  const topCounterpartyIds = topCounterpartiesRaw.map((r) => r._id).filter(Boolean);

  const topCounterpartyUsers =
    topCounterpartyIds.length > 0
      ? await User.find(
          { _id: { $in: topCounterpartyIds }, organizationId: orgId },
          { name: 1, username: 1, role: 1 }
        ).lean()
      : [];

  const topUserMap = new Map<string, any>();
  for (const u of topCounterpartyUsers) {
    topUserMap.set(String(u._id), u);
  }

  const topCounterparties = topCounterpartiesRaw.map((r) => {
    const u = topUserMap.get(String(r._id));
    return {
      id: String(r._id),
      name: u?.name ?? "-",
      username: u?.username ?? "-",
      role: (u?.role as Role) ?? "PARTNER",
      useCount: Number(r.useCount ?? 0),
      usedPoints: Number(r.usedPoints ?? 0),
    };
  });

  const recentLedger = await Ledger.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(8).lean();

  const relationIds = new Set<string>();
  for (const row of recentLedger as any[]) {
    if (row.accountId) relationIds.add(String(row.accountId));
    if (row.actorId) relationIds.add(String(row.actorId));
    if (row.userId) relationIds.add(String(row.userId));
    if (row.counterpartyId) relationIds.add(String(row.counterpartyId));
  }

  const relationUsers =
    relationIds.size > 0
      ? await User.find(
          {
            _id: {
              $in: Array.from(relationIds).map(
                (id) => new mongoose.Types.ObjectId(id)
              ),
            },
            organizationId: orgId,
          },
          { name: 1, username: 1, role: 1 }
        ).lean()
      : [];

  const relationUserMap = new Map<string, any>();
  for (const u of relationUsers) {
    relationUserMap.set(String(u._id), u);
  }

  const recentActivities = (recentLedger as any[]).map((row) => ({
    id: String(row._id),
    type: String(row.type ?? "-"),
    amount: Number(row.amount ?? 0),
    createdAt: row.createdAt,
    account: row.accountId ? relationUserMap.get(String(row.accountId)) : null,
    actor: row.actorId ? relationUserMap.get(String(row.actorId)) : null,
    counterparty: row.counterpartyId
      ? relationUserMap.get(String(row.counterpartyId))
      : null,
    note: row.note ?? "",
  }));

  const filter: any = { organizationId: orgId };

  if (activeRole !== "ALL") {
    filter.role = activeRole;
  }

  if (q) {
    filter.$or = [
      { username: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } },
    ];
  }

  const rows = await User.find(
    filter,
    { username: 1, name: 1, role: 1, status: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(80)
    .lean();

  const userIds = rows.map(
    (u: any) => new mongoose.Types.ObjectId(String(u._id))
  );

  const sums =
    userIds.length === 0
      ? []
      : await Ledger.aggregate([
          { $match: { accountId: { $in: userIds } } },
          { $group: { _id: "$accountId", balance: { $sum: "$amount" } } },
        ]);

  const balanceMap = new Map<string, number>();
  for (const s of sums) {
    balanceMap.set(String(s._id), Number(s.balance ?? 0));
  }

  const users = rows.map((u: any) => ({
    id: String(u._id),
    username: u.username,
    name: u.name,
    role: u.role as Role,
    status: u.status as Status,
    createdAt: u.createdAt,
    balance: balanceMap.get(String(u._id)) ?? 0,
  }));

  async function updateUserRole(formData: FormData) {
    "use server";

    const { getSessionFromCookies } = await import("@/lib/auth");
    const { connectDB } = await import("@/lib/db");
    const { User } = await import("@/models/User");

    const s = await getSessionFromCookies();
    if (!s) {
      redirect(`/${orgSlug}/login`);
      return;
    }

    if (s.role !== "ADMIN") {
      throw new Error("FORBIDDEN");
    }

    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "");

    if (!["CUSTOMER", "PARTNER"].includes(role)) {
      throw new Error("INVALID_ROLE");
    }

    await connectDB();
    await User.updateOne({ _id: userId }, { $set: { role } });
  }

  const tabs: { key: "ALL" | Role; label: string; href: string }[] = [
    {
      key: "ALL",
      label: "전체",
      href: q ? `/${orgSlug}/admin?q=${encodeURIComponent(q)}` : `/${orgSlug}/admin`,
    },
    {
      key: "CUSTOMER",
      label: "고객",
      href: `/${orgSlug}/admin?role=CUSTOMER${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    },
    {
      key: "PARTNER",
      label: "제휴사",
      href: `/${orgSlug}/admin?role=PARTNER${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    },
    {
      key: "ADMIN",
      label: "총괄관리자",
      href: `/${orgSlug}/admin?role=ADMIN${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    },
  ];

  const totalPending = pendingTopupCount + pendingIssueCount + pendingUseCount;

  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-8 space-y-5">

      {/* ── Hero Header ── */}
      <section className="bg-card shadow-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-1">
            운영 요약
          </p>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
            관리자 대시보드
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            승인 대기, 운영 KPI, 거래 현황, 정산 흐름을 한 번에 확인합니다.
          </p>
        </div>

        <div className="bg-muted/50 rounded-2xl px-5 py-4 min-w-[180px]">
          <p className="text-sm text-muted-foreground font-semibold mb-1">전체 사용자</p>
          <p className="text-3xl font-black text-foreground tracking-tight">
            {formatNumber(totalUsers)}
            <span className="text-lg font-bold">명</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            고객 {formatNumber(customerCount)} / 제휴사 {formatNumber(partnerCount)}
          </p>
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Primary KPI — pending total */}
        <div className="bg-primary rounded-2xl p-5 text-primary-foreground">
          <p className="text-sm font-semibold opacity-80">승인 대기 전체</p>
          <p className="text-3xl font-black tracking-tight mt-2">
            {formatNumber(totalPending)}
            <span className="text-lg font-bold">건</span>
          </p>
          <p className="mt-2 text-xs opacity-70">
            충전 {formatNumber(pendingTopupCount)} / 지급{" "}
            {formatNumber(pendingIssueCount)} / 사용 {formatNumber(pendingUseCount)}
          </p>
        </div>

        <div className="bg-card shadow-card rounded-2xl p-5">
          <p className="text-sm text-muted-foreground font-semibold">오늘 지급 포인트</p>
          <p className="text-3xl font-black text-foreground tracking-tight mt-2">
            {formatNumber(todayIssueAmount)}
            <span className="text-lg font-bold">P</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">지급 내역 기준</p>
        </div>

        <div className="bg-card shadow-card rounded-2xl p-5">
          <p className="text-sm text-muted-foreground font-semibold">오늘 사용 포인트</p>
          <p className="text-3xl font-black text-foreground tracking-tight mt-2">
            {formatNumber(todayUseAmount)}
            <span className="text-lg font-bold">P</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">사용 내역 기준</p>
        </div>

        <div className="bg-card shadow-card rounded-2xl p-5">
          <p className="text-sm text-muted-foreground font-semibold">이번달 예상 지급액</p>
          <p className="text-3xl font-black text-foreground tracking-tight mt-2">
            {formatNumber(monthExpectedPayout)}
            <span className="text-lg font-bold">P</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">이번달 사용포인트 기준</p>
        </div>
      </section>

      {/* ── Main Two-Column Grid ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">

        {/* Recent Ledger Activity */}
        <div className="bg-card shadow-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-foreground">최근 거래 내역</h2>
            <span className="text-xs text-muted-foreground font-semibold">가장 최근 8건</span>
          </div>

          <div className="space-y-0">
            {recentActivities.length > 0 ? (
              recentActivities.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center py-3 border-b border-border last:border-0 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge
                        className={cn(
                          "text-[10px] font-black",
                          r.type === "ISSUE" && "bg-blue-100 text-blue-700 border-blue-200",
                          r.type === "USE" && "bg-violet-100 text-violet-700 border-violet-200",
                          r.type === "TOPUP" && "bg-emerald-100 text-emerald-700 border-emerald-200",
                          r.type !== "ISSUE" && r.type !== "USE" && r.type !== "TOPUP" && "bg-muted text-muted-foreground"
                        )}
                        variant="outline"
                      >
                        {(LEDGER_TYPE_LABEL as Record<string, string>)[r.type] ?? r.type}
                      </Badge>
                      <span className="text-sm font-bold text-foreground truncate">
                        {r.account?.name ?? "계정 정보 없음"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.counterparty
                        ? `상대: ${r.counterparty.name}`
                        : r.actor
                        ? `실행자: ${r.actor.name}`
                        : "상대 정보 없음"}
                      {" · "}
                      {formatKrDateTime(r.createdAt)}
                    </p>
                  </div>
                  <span className="text-base font-black text-foreground whitespace-nowrap shrink-0">
                    {formatNumber(Math.abs(r.amount))}P
                  </span>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                최근 활동이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Approvals + Quick Actions */}
        <div className="bg-card shadow-card rounded-2xl p-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-foreground">승인 대기</h2>
              <span className="text-xs text-muted-foreground font-semibold">자주 쓰는 운영 액션</span>
            </div>

            <div className="space-y-2">
              {[
                {
                  href: `/${orgSlug}/admin/topup-requests`,
                  label: "충전요청 승인 대기",
                  count: pendingTopupCount,
                  sub: "충전 승인 처리 화면으로 이동",
                },
                {
                  href: `/${orgSlug}/admin/issue-requests`,
                  label: "지급요청 승인 대기",
                  count: pendingIssueCount,
                  sub: "고객 포인트 지급 승인 처리",
                },
                {
                  href: `/${orgSlug}/admin/use-requests`,
                  label: "사용요청 승인 대기",
                  count: pendingUseCount,
                  sub: "사용 승인 / 거절 처리",
                },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between bg-muted/40 hover:bg-muted/70 border border-border rounded-xl px-4 py-3 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                  <span
                    className={cn(
                      "text-xl font-black tracking-tight shrink-0",
                      item.count > 0 ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {formatNumber(item.count)}건
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Action Chips */}
          <div>
            <p className="text-xs text-muted-foreground font-semibold mb-2">빠른 이동</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: `/${orgSlug}/admin/topup`, label: "관리자 수동 충전" },
                { href: `/${orgSlug}/admin/adjust`, label: "포인트 조정" },
                { href: `/${orgSlug}/admin/ledger`, label: "전체 내역" },
                { href: `/${orgSlug}/admin/settlements`, label: "제휴사 관리" },
                { href: `/${orgSlug}/admin/accounts`, label: "계정 조회" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-center text-center text-sm font-bold text-foreground bg-background shadow-card rounded-xl py-2.5 px-3 hover:border-primary hover:text-primary transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* Summary mini stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground font-semibold">전체 사용자</p>
              <p className="text-lg font-black text-foreground mt-1">{formatNumber(totalUsers)}명</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground font-semibold">고객</p>
              <p className="text-lg font-black text-foreground mt-1">{formatNumber(customerCount)}명</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground font-semibold">제휴사</p>
              <p className="text-lg font-black text-foreground mt-1">{formatNumber(partnerCount)}명</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Monthly Summary + Top Counterparties ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">

        {/* Monthly Summary */}
        <div className="bg-card shadow-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-foreground">이번달 운영 요약</h2>
            <span className="text-xs text-muted-foreground font-semibold">월 누적 기준</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-muted/40 rounded-xl p-4">
              <p className="text-sm text-muted-foreground font-semibold">이번달 사용건수</p>
              <p className="text-2xl font-black text-foreground tracking-tight mt-2">
                {formatNumber(monthUseCount)}
                <span className="text-base font-bold">건</span>
              </p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4">
              <p className="text-sm text-muted-foreground font-semibold">이번달 사용포인트</p>
              <p className="text-2xl font-black text-foreground tracking-tight mt-2">
                {formatNumber(monthUsedPoints)}
                <span className="text-base font-bold">P</span>
              </p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4">
              <p className="text-sm text-muted-foreground font-semibold">이번달 지급포인트</p>
              <p className="text-2xl font-black text-foreground tracking-tight mt-2">
                {formatNumber(monthMap.get("ISSUE")?.amount ?? 0)}
                <span className="text-base font-bold">P</span>
              </p>
            </div>
          </div>
        </div>

        {/* Top Counterparties */}
        <div className="bg-card shadow-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-foreground">이번달 TOP 사용처</h2>
            <span className="text-xs text-muted-foreground font-semibold">사용포인트 기준</span>
          </div>

          <div className="space-y-0">
            {topCounterparties.length > 0 ? (
              topCounterparties.map((row, idx) => (
                <div
                  key={row.id}
                  className="flex items-center py-3 border-b border-border last:border-0 gap-3"
                >
                  <span className="text-xs font-black text-muted-foreground w-5 shrink-0 text-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{row.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatUsername(row.username)} · {ROLE_LABEL[row.role]} · {formatNumber(row.useCount)}건
                    </p>
                  </div>
                  <span className="text-base font-black text-foreground whitespace-nowrap shrink-0">
                    {formatNumber(row.usedPoints)}P
                  </span>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                이번달 사용 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── User Management ── */}
      <section className="bg-card shadow-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground">사용자 관리</h2>
          <span className="text-xs text-muted-foreground font-semibold">검색 / 역할 필터 / 역할 변경</span>
        </div>

        {/* Search Bar */}
        <form action={`/${orgSlug}/admin`} method="GET" className="flex flex-wrap gap-2 mb-3">
          {activeRole !== "ALL" && (
            <input type="hidden" name="role" value={activeRole} />
          )}
          <input
            name="q"
            defaultValue={q}
            placeholder="아이디 또는 이름 검색"
            className="flex-1 min-w-[200px] h-11 rounded-xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            type="submit"
            className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            검색
          </button>
          <a
            href={activeRole === "ALL" ? `/${orgSlug}/admin` : `/${orgSlug}/admin?role=${activeRole}`}
            className="inline-flex items-center h-11 px-5 rounded-xl border border-border bg-background text-sm font-bold text-foreground hover:bg-muted transition-colors"
          >
            초기화
          </a>
        </form>

        {/* Role Tab Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((t) => (
            <a
              key={t.key}
              href={t.href}
              className={cn(
                "inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold border transition-colors",
                activeRole === t.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary hover:text-primary"
              )}
            >
              {t.label}
            </a>
          ))}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          현재:{" "}
          <span className="font-bold text-foreground">
            {activeRole === "ALL" ? "전체" : ROLE_LABEL[activeRole]}
          </span>{" "}
          / 표시 {users.length}명
        </p>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl shadow-card">
          <div className="min-w-[900px]">
            {/* Table Header */}
            <div className="grid grid-cols-[180px_140px_100px_100px_220px_120px_160px] gap-3 items-center px-4 py-3 bg-muted/50 border-b border-border text-xs font-black text-muted-foreground uppercase tracking-wide">
              <div>아이디</div>
              <div>이름</div>
              <div>역할</div>
              <div>상태</div>
              <div>역할 변경</div>
              <div>잔액</div>
              <div>가입일</div>
            </div>

            {users.length > 0 ? (
              users.map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[180px_140px_100px_100px_220px_120px_160px] gap-3 items-center px-4 py-3.5 border-b border-border last:border-0 text-sm hover:bg-muted/30 transition-colors"
                >
                  <div className="truncate font-medium text-foreground">{formatUsername(u.username)}</div>
                  <div className="truncate text-foreground">{u.name}</div>
                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-bold",
                        u.role === "ADMIN" && "bg-amber-50 text-amber-700 border-amber-200",
                        u.role === "PARTNER" && "bg-blue-50 text-blue-700 border-blue-200",
                        u.role === "CUSTOMER" && "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}
                    >
                      {ROLE_LABEL[u.role]}
                    </Badge>
                  </div>
                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-bold",
                        u.status === "ACTIVE" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        u.status === "PENDING" && "bg-yellow-50 text-yellow-700 border-yellow-200",
                        u.status === "BLOCKED" && "bg-red-50 text-red-700 border-red-200"
                      )}
                    >
                      {STATUS_LABEL[u.status]}
                    </Badge>
                  </div>
                  <div>
                    {u.role === "ADMIN" ? (
                      <span className="text-xs text-muted-foreground font-semibold">변경 불가</span>
                    ) : (
                      <form action={updateUserRole} className="flex gap-2 items-center">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role}
                          className="h-9 rounded-lg border border-border bg-background px-2 text-sm font-semibold text-foreground outline-none focus:border-primary"
                        >
                          <option value="CUSTOMER">고객</option>
                          <option value="PARTNER">제휴사</option>
                        </select>
                        <button
                          type="submit"
                          className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-bold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                        >
                          적용
                        </button>
                      </form>
                    )}
                  </div>
                  <div className="font-black text-foreground">
                    {formatNumber(u.balance)}P
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {formatKrDateTime(u.createdAt)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                사용자가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Mobile User Cards */}
        <div className="flex flex-col gap-3 md:hidden">
          {users.length > 0 ? (
            users.map((u) => (
              <div
                key={u.id}
                className="bg-card shadow-card rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatUsername(u.username)}</p>
                  </div>
                  <p className="text-lg font-black text-foreground whitespace-nowrap shrink-0">
                    {formatNumber(u.balance)}P
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-bold",
                      u.role === "ADMIN" && "bg-amber-50 text-amber-700 border-amber-200",
                      u.role === "PARTNER" && "bg-blue-50 text-blue-700 border-blue-200",
                      u.role === "CUSTOMER" && "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}
                  >
                    {ROLE_LABEL[u.role]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-bold",
                      u.status === "ACTIVE" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                      u.status === "PENDING" && "bg-yellow-50 text-yellow-700 border-yellow-200",
                      u.status === "BLOCKED" && "bg-red-50 text-red-700 border-red-200"
                    )}
                  >
                    {STATUS_LABEL[u.status]}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground text-xs font-semibold">가입일</span>
                    <span className="text-xs text-foreground">
                      {formatKrDateTime(u.createdAt)}
                    </span>
                  </div>
                </div>

                {u.role === "ADMIN" ? (
                  <p className="mt-3 text-xs text-muted-foreground font-semibold">
                    총괄관리자는 역할 변경 불가
                  </p>
                ) : (
                  <form action={updateUserRole} className="mt-3 flex gap-2 flex-wrap">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="flex-1 min-w-[120px] h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
                    >
                      <option value="CUSTOMER">고객</option>
                      <option value="PARTNER">제휴사</option>
                    </select>
                    <button
                      type="submit"
                      className="h-9 px-4 rounded-lg border border-border bg-background text-sm font-bold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                    >
                      적용
                    </button>
                  </form>
                )}
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              사용자가 없습니다.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
