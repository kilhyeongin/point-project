import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { Organization } from "@/models/Organization";

type Context = { params: Promise<{ slug: string }> };

async function requireSuperAdmin() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "SUPER_ADMIN") return null;
  return session;
}

// PATCH: 조직 활성화/비활성화 또는 이름 변경
export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });

  const { slug } = await params;
  const body = await req.json();

  await connectDB();

  const update: Record<string, any> = {};
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim().slice(0, 100);

  if (Object.keys(update).length === 0)
    return NextResponse.json({ ok: false, error: "변경할 내용이 없습니다." }, { status: 400 });

  const org = await Organization.findOneAndUpdate({ slug }, { $set: update }, { new: true }).lean();
  if (!org) return NextResponse.json({ ok: false, error: "조직을 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
