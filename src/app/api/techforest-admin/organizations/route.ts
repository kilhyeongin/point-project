import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { Organization } from "@/models/Organization";
import { User } from "@/models/User";
import { validatePassword } from "@/lib/validatePassword";

async function requireSuperAdmin() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "SUPER_ADMIN") return null;
  return session;
}

function generateSlug(length = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = generateSlug(4);
    const exists = await Organization.findOne({ slug }, { _id: 1 }).lean();
    if (!exists) return slug;
  }
  return generateSlug(6);
}

// GET: 전체 조직 목록
export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });

  await connectDB();

  const orgs = await Organization.find({}, { slug: 1, name: 1, isActive: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .lean();

  const counts = await User.aggregate([
    { $match: { organizationId: { $in: (orgs as any[]).map((o) => o.slug) } } },
    { $group: { _id: { org: "$organizationId", role: "$role" }, count: { $sum: 1 } } },
  ]);

  const countMap: Record<string, Record<string, number>> = {};
  for (const c of counts) {
    const org = c._id.org;
    const role = c._id.role;
    if (!countMap[org]) countMap[org] = {};
    countMap[org][role] = c.count;
  }

  const results = (orgs as any[]).map((org) => ({
    slug: org.slug,
    name: org.name,
    isActive: org.isActive,
    createdAt: org.createdAt,
    adminCount: countMap[org.slug]?.ADMIN ?? 0,
    partnerCount: countMap[org.slug]?.PARTNER ?? 0,
    customerCount: countMap[org.slug]?.CUSTOMER ?? 0,
  }));

  return NextResponse.json({ ok: true, organizations: results });
}

// POST: 신규 조직 생성
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });

  try {
    const body = await req.json();
    const rawSlug = String(body?.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50);
    const name = String(body?.name ?? "").trim().slice(0, 100);
    const adminUsername = String(body?.adminUsername ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    const adminPassword = String(body?.adminPassword ?? "");
    const adminName = String(body?.adminName ?? "").trim().slice(0, 50) || `${name} 관리자`;

    if (!name) return NextResponse.json({ ok: false, error: "조직 이름을 입력해 주세요." }, { status: 400 });
    if (!adminUsername || adminUsername.length < 4)
      return NextResponse.json({ ok: false, error: "관리자 아이디는 4자 이상이어야 합니다." }, { status: 400 });

    const pwCheck = validatePassword(adminPassword);
    if (!pwCheck.ok) return NextResponse.json({ ok: false, error: pwCheck.error }, { status: 400 });

    await connectDB();

    const slug = rawSlug.length >= 2 ? rawSlug : await uniqueSlug();

    const existingOrg = await Organization.findOne({ slug }).lean();
    if (existingOrg)
      return NextResponse.json({ ok: false, error: `이미 사용 중인 slug입니다: ${slug}` }, { status: 409 });

    const existingAdmin = await User.findOne({ username: adminUsername, organizationId: slug }, { _id: 1 }).lean();
    if (existingAdmin)
      return NextResponse.json({ ok: false, error: "이미 사용 중인 관리자 아이디입니다." }, { status: 409 });

    const org = await Organization.create({ slug, name, isActive: true });
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminUser = await User.create({
      organizationId: slug,
      username: adminUsername,
      passwordHash,
      name: adminName,
      role: "ADMIN",
      status: "ACTIVE",
      pointBalance: 0,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    return NextResponse.json({
      ok: true,
      organization: { slug: org.slug, name: org.name, isActive: org.isActive },
      admin: { username: adminUser.username, name: adminUser.name },
      loginUrl: `${baseUrl}/${slug}/login`,
    });
  } catch (error) {
    console.error("[SUPER_ADMIN_ORG_CREATE_ERROR]", error);
    return NextResponse.json({ ok: false, error: "조직 생성에 실패했습니다." }, { status: 500 });
  }
}
