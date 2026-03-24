// src/app/api/requesters/customers/route.ts
// =======================================================
// PARTNER 전용: 연결된 고객 조회 API
// -------------------------------------------------------
// - 전체 고객 조회 금지
// - LIKED  : 잠재고객(최소 정보만 공개)
// - APPLIED: 신청고객(상세 정보 공개)
// =======================================================

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionFromCookies } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FavoritePartner } from "@/models/FavoritePartner";
import { User } from "@/models/User";

function maskName(name: string) {
  const value = String(name ?? "").trim();
  if (!value) return "이름 미입력";
  if (value.length <= 1) return `${value}*`;
  if (value.length === 2) return `${value[0]}*`;
  return `${value[0]}${"*".repeat(Math.max(1, value.length - 2))}${value[value.length - 1]}`;
}

function maskUsername(username: string) {
  const value = String(username ?? "").trim();
  if (!value) return "-";
  if (value.length <= 3) return `${value.slice(0, 1)}**`;
  return `${value.slice(0, 3)}***`;
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (session.role !== "PARTNER") {
    return NextResponse.json(
      { ok: false, message: "제휴사만 접근 가능합니다." },
      { status: 403 }
    );
  }

  if (!mongoose.Types.ObjectId.isValid(session.uid)) {
    return NextResponse.json(
      { ok: false, message: "세션 사용자 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim().toLowerCase();
  const statusParam = String(searchParams.get("status") ?? "ALL").trim().toUpperCase();

  const partnerId = new mongoose.Types.ObjectId(session.uid);

  const filter: Record<string, any> = {
    partnerId,
  };

  if (statusParam === "LIKED" || statusParam === "APPLIED") {
    filter.status = statusParam;
  }

  const relations = await FavoritePartner.find(
    filter,
    {
      customerId: 1,
      status: 1,
      createdAt: 1,
      updatedAt: 1,
      appliedAt: 1,
    }
  )
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  const customerIds = relations
    .map((item: any) => String(item.customerId ?? ""))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (customerIds.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        items: [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const customers = await User.find(
    {
      _id: { $in: customerIds },
      role: "CUSTOMER",
    },
    {
      username: 1,
      name: 1,
      status: 1,
      createdAt: 1,
      customerProfile: 1,
    }
  ).lean();

  const customerMap = new Map<string, any>();
  for (const customer of customers as any[]) {
    customerMap.set(String(customer._id), customer);
  }

  const items = relations
    .map((relation: any) => {
      const customer = customerMap.get(String(relation.customerId));
      if (!customer) return null;

      const relationStatus =
        String(relation.status ?? "LIKED") === "APPLIED" ? "APPLIED" : "LIKED";
      const profile = customer.customerProfile ?? {};

      const base = {
        id: String(customer._id),
        relationStatus,
        likedAt: relation.createdAt,
        appliedAt: relation.appliedAt ?? null,
        createdAt: customer.createdAt,
      };

      if (relationStatus === "APPLIED") {
        return {
          ...base,
          username: String(customer.username ?? ""),
          name: String(customer.name ?? ""),
          phone: String(profile.phone ?? "").trim(),
          address: String(profile.address ?? "").trim(),
          detailAddress: String(profile.detailAddress ?? "").trim(),
          status: String(customer.status ?? ""),
          isMasked: false,
        };
      }

      return {
        ...base,
        username: maskUsername(String(customer.username ?? "")),
        name: maskName(String(customer.name ?? "")),
        phone: "비공개",
        address: "비공개",
        detailAddress: "비공개",
        status: String(customer.status ?? ""),
        isMasked: true,
      };
    })
    .filter(Boolean)
    .filter((item: any) => {
      if (!q) return true;
      return [item.username, item.name].some((value) =>
        String(value ?? "").toLowerCase().includes(q)
      );
    });

  return NextResponse.json(
    {
      ok: true,
      items,
      counts: {
        liked: items.filter((item: any) => item.relationStatus === "LIKED").length,
        applied: items.filter((item: any) => item.relationStatus === "APPLIED").length,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}