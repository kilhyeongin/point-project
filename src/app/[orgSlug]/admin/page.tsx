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
import { WithdrawalRequest } from "@/models/WithdrawalRequest";
import { PointSettlementPayment } from "@/models/PointSettlementPayment";
import { GeneralSettlement } from "@/models/GeneralSettlement";
import { FavoritePartner } from "@/models/FavoritePartner";
import { Badge } from "@/components/ui/badge";
import { cn, formatUsername } from "@/lib/utils";
import RecentActivities from "./RecentActivities";
import UserList from "./UserList";
import PointStatToggle from "./PointStatToggle";
import ContractStats from "./ContractStats";

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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
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

  const orgId = session.orgId ?? "4nwn";

  const [
    pendingTopupCount,
    pendingPartnerCount,
    pendingWithdrawalCount,
    pendingPointSettlementCount,
    pendingGeneralSettlementCount,
    totalUsers,
    customerCount,
    partnerCount,
  ] = await Promise.all([
    TopupRequest.countDocuments({ organizationId: orgId, status: "PENDING" }),
    User.countDocuments({ organizationId: orgId, role: "PARTNER", status: "PENDING" }),
    WithdrawalRequest.countDocuments({ organizationId: orgId, status: "PENDING" }),
    PointSettlementPayment.countDocuments({ organizationId: orgId, status: "PENDING" }),
    GeneralSettlement.countDocuments({ organizationId: orgId, status: "SUBMITTED" }),
    User.countDocuments({ organizationId: orgId }),
    User.countDocuments({ organizationId: orgId, role: "CUSTOMER" }),
    User.countDocuments({ organizationId: orgId, role: "PARTNER" }),
  ]);


  // 계약 현황 (FavoritePartner.contractedAt != null 기준)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [todayContractCount, monthlyContractRaw] = await Promise.all([
    FavoritePartner.countDocuments({ organizationId: orgId, contractedAt: { $gte: todayStart, $lte: todayEnd } }),
    FavoritePartner.aggregate([
      { $match: { organizationId: orgId, contractedAt: { $gte: twelveMonthsAgo, $ne: null } } },
      { $group: { _id: { year: { $year: "$contractedAt" }, month: { $month: "$contractedAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
    ]),
  ]);

  const monthlyStats = monthlyContractRaw.map((r: any) => ({
    year: r._id.year,
    month: r._id.month,
    count: r.count,
  }));

  const ledgerStatRows = await Ledger.aggregate([
    {
      $match: {
        organizationId: orgId,
        type: { $in: ["USE", "ISSUE"] },
      },
    },
    {
      $facet: {
        today: [
          { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
          { $group: { _id: "$type", amount: { $sum: { $abs: "$amount" } } } },
        ],
        month: [
          { $match: { createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd } } },
          { $group: { _id: "$type", amount: { $sum: { $abs: "$amount" } } } },
        ],
      },
    },
  ]);

  const todayStatMap = new Map<string, number>();
  for (const r of ledgerStatRows[0]?.today ?? []) todayStatMap.set(r._id, Number(r.amount ?? 0));
  const monthStatMap = new Map<string, number>();
  for (const r of ledgerStatRows[0]?.month ?? []) monthStatMap.set(r._id, Number(r.amount ?? 0));

  const todayUseAmount = todayStatMap.get("USE") ?? 0;
  const todayIssueAmount = todayStatMap.get("ISSUE") ?? 0;
  const monthUseAmount = monthStatMap.get("USE") ?? 0;
  const monthIssueAmount = monthStatMap.get("ISSUE") ?? 0;

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

  const recentLedger = await Ledger.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(20).lean();

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

  function toUserPlain(u: any) {
    if (!u) return null;
    return { name: String(u.name ?? "-"), role: String(u.role ?? "") };
  }

  const recentActivities = (recentLedger as any[]).map((row) => ({
    id: String(row._id),
    type: String(row.type ?? "-"),
    amount: Number(row.amount ?? 0),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    account: toUserPlain(row.accountId ? relationUserMap.get(String(row.accountId)) : null),
    actor: toUserPlain(row.actorId ? relationUserMap.get(String(row.actorId)) : null),
    counterparty: toUserPlain(row.counterpartyId ? relationUserMap.get(String(row.counterpartyId)) : null),
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

  const totalPending = pendingTopupCount + pendingPartnerCount + pendingWithdrawalCount + pendingPointSettlementCount + pendingGeneralSettlementCount;

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
            승인 대기·포인트 현황·계약 현황·거래 내역을 한 번에 확인합니다.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="bg-muted/50 rounded-2xl px-4 py-3 flex-[2] min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground font-semibold mb-1">전체 사용자</p>
            <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight">
              {formatNumber(totalUsers)}
              <span className="text-sm sm:text-lg font-bold">명</span>
            </p>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground">
              고객 {formatNumber(customerCount)} / 제휴사 {formatNumber(partnerCount)}
            </p>
          </div>
          <ContractStats todayCount={todayContractCount} monthlyStats={monthlyStats} />
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 승인 대기 전체 */}
        <div className="bg-primary rounded-2xl p-5 text-primary-foreground">
          <p className="text-sm font-semibold opacity-80">승인 대기 전체</p>
          <p className="text-3xl font-black tracking-tight mt-2">
            {formatNumber(totalPending)}
            <span className="text-lg font-bold">건</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <a href={`/${orgSlug}/admin/topup-requests`} className="text-xs opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity">
              충전 {formatNumber(pendingTopupCount)}건
            </a>
            <a href={`/${orgSlug}/admin/partner-approvals`} className="text-xs opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity">
              제휴사 승인 {formatNumber(pendingPartnerCount)}건
            </a>
            <a href={`/${orgSlug}/admin/settlements/partners?tab=withdrawal`} className="text-xs opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity">
              출금 {formatNumber(pendingWithdrawalCount)}건
            </a>
            <a href={`/${orgSlug}/admin/settlements/partners?tab=point-settlement`} className="text-xs opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity">
              포인트 정산 {formatNumber(pendingPointSettlementCount)}건
            </a>
            <a href={`/${orgSlug}/admin/settlements/partners?tab=general`} className="text-xs opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity">
              일반 정산 확인 {formatNumber(pendingGeneralSettlementCount)}건
            </a>
          </div>
        </div>

        {/* 전체 포인트 관리 */}
        <div className="bg-card shadow-card rounded-2xl p-5 flex flex-col justify-between">
          <p className="text-sm text-muted-foreground font-semibold mb-3">전체 포인트 관리</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`/${orgSlug}/admin/partner-points`}
              className="flex items-center justify-center px-4 py-2.5 bg-muted hover:bg-muted/60 text-foreground rounded-xl text-sm font-bold transition-colors border border-border"
            >
              제휴사 포인트 관리
            </a>
            <a
              href={`/${orgSlug}/admin/customer-points`}
              className="flex items-center justify-center px-4 py-2.5 bg-muted hover:bg-muted/60 text-foreground rounded-xl text-sm font-bold transition-colors border border-border"
            >
              고객 포인트 관리
            </a>
          </div>
        </div>

      </section>

      {/* ── 포인트 사용내역 ── */}
      <PointStatToggle
        todayUse={todayUseAmount}
        todayIssue={todayIssueAmount}
        monthUse={monthUseAmount}
        monthIssue={monthIssueAmount}
      />

      {/* ── Recent Ledger Activity + TOP 사용처 ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5 items-start">
        <RecentActivities activities={recentActivities} />

        {/* TOP 사용처 */}
        <div className="bg-card shadow-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-foreground">이번달 TOP 사용처</h2>
            <span className="text-xs text-muted-foreground font-semibold">사용포인트 기준</span>
          </div>
          <div className="space-y-0">
            {topCounterparties.length > 0 ? (
              topCounterparties.map((row, idx) => (
                <div key={row.id} className="flex items-center py-3 border-b border-border last:border-0 gap-3">
                  <span className="text-xs font-black text-muted-foreground w-5 shrink-0 text-center">{idx + 1}</span>
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
          <span className="text-xs text-muted-foreground font-semibold">총 {users.length}명</span>
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
            className="flex-1 min-w-[200px] h-10 rounded-xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button type="submit" className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors">
            검색
          </button>
          <a
            href={activeRole === "ALL" ? `/${orgSlug}/admin` : `/${orgSlug}/admin?role=${activeRole}`}
            className="inline-flex items-center h-10 px-4 rounded-xl border border-border bg-background text-sm font-bold text-foreground hover:bg-muted transition-colors"
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

        <UserList users={users.map((u) => ({ ...u, createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt ?? "") }))} updateUserRole={updateUserRole} />
      </section>
    </main>
  );
}
