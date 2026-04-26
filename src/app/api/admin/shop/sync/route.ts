import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { ShopProduct } from "@/models/ShopProduct";

type SmartconProduct = {
  productCode: string;
  productName: string;
  brand: string;
  price: number;
  imageUrl: string;
  expirationDays: number;
  description: string;
};

// 스마트콘 상품 목록 API 호출
// API 키 발급 후 실제 구현으로 교체
async function fetchSmartconCatalog(): Promise<SmartconProduct[]> {
  const apiKey = process.env.SMARTCON_API_KEY;

  if (apiKey) {
    // TODO: 실제 스마트콘 상품 목록 API 연동
    // const res = await fetch("https://api.smartcon.co.kr/v1/products", {
    //   headers: { Authorization: `Bearer ${apiKey}` },
    // });
    // const data = await res.json();
    // return data.products;
  }

  // Mock 카탈로그 — API 키 발급 전 테스트용
  return [
    {
      productCode: "NAVER_PAY_10000",
      productName: "네이버페이 1만원권",
      brand: "네이버페이",
      price: 10000,
      imageUrl: "",
      expirationDays: 180,
      description: "네이버페이 포인트로 전환 가능한 상품권",
    },
    {
      productCode: "NAVER_PAY_30000",
      productName: "네이버페이 3만원권",
      brand: "네이버페이",
      price: 30000,
      imageUrl: "",
      expirationDays: 180,
      description: "네이버페이 포인트로 전환 가능한 상품권",
    },
    {
      productCode: "NAVER_PAY_50000",
      productName: "네이버페이 5만원권",
      brand: "네이버페이",
      price: 50000,
      imageUrl: "",
      expirationDays: 180,
      description: "네이버페이 포인트로 전환 가능한 상품권",
    },
    {
      productCode: "KAKAO_PAY_10000",
      productName: "카카오페이 1만원권",
      brand: "카카오페이",
      price: 10000,
      imageUrl: "",
      expirationDays: 180,
      description: "카카오페이로 사용 가능한 상품권",
    },
    {
      productCode: "KAKAO_PAY_30000",
      productName: "카카오페이 3만원권",
      brand: "카카오페이",
      price: 30000,
      imageUrl: "",
      expirationDays: 180,
      description: "카카오페이로 사용 가능한 상품권",
    },
    {
      productCode: "KAKAO_PAY_50000",
      productName: "카카오페이 5만원권",
      brand: "카카오페이",
      price: 50000,
      imageUrl: "",
      expirationDays: 180,
      description: "카카오페이로 사용 가능한 상품권",
    },
    {
      productCode: "STARBUCKS_10000",
      productName: "스타벅스 1만원권",
      brand: "스타벅스",
      price: 10000,
      imageUrl: "",
      expirationDays: 365,
      description: "스타벅스 전 매장 사용 가능",
    },
    {
      productCode: "STARBUCKS_30000",
      productName: "스타벅스 3만원권",
      brand: "스타벅스",
      price: 30000,
      imageUrl: "",
      expirationDays: 365,
      description: "스타벅스 전 매장 사용 가능",
    },
    {
      productCode: "BAEMIN_10000",
      productName: "배달의민족 1만원권",
      brand: "배달의민족",
      price: 10000,
      imageUrl: "",
      expirationDays: 90,
      description: "배달의민족 앱에서 사용 가능",
    },
    {
      productCode: "BAEMIN_30000",
      productName: "배달의민족 3만원권",
      brand: "배달의민족",
      price: 30000,
      imageUrl: "",
      expirationDays: 90,
      description: "배달의민족 앱에서 사용 가능",
    },
    {
      productCode: "CU_10000",
      productName: "CU 1만원권",
      brand: "CU",
      price: 10000,
      imageUrl: "",
      expirationDays: 365,
      description: "CU 편의점 전국 매장 사용 가능",
    },
    {
      productCode: "GS25_10000",
      productName: "GS25 1만원권",
      brand: "GS25",
      price: 10000,
      imageUrl: "",
      expirationDays: 365,
      description: "GS25 편의점 전국 매장 사용 가능",
    },
  ];
}

export async function POST() {
  try {
    const session = await getSessionFromCookies();

    if (!session || !["ADMIN", "HOST"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    await connectDB();

    const orgId = session.orgId ?? "4nwn";
    const catalog = await fetchSmartconCatalog();

    let added = 0;
    let updated = 0;
    let unchanged = 0;

    for (let i = 0; i < catalog.length; i++) {
      const item = catalog[i];

      // upsert로 race condition 방지 (동시 동기화 요청도 안전)
      const result = await ShopProduct.findOneAndUpdate(
        { organizationId: orgId, smartconProductCode: item.productCode },
        {
          $set: {
            name: item.productName,
            brand: item.brand,
            description: item.description,
            ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
            expirationDays: item.expirationDays,
            updatedBy: session.username,
          },
          $setOnInsert: {
            organizationId: orgId,
            smartconProductCode: item.productCode,
            pointCost: item.price,
            isActive: true,
            sortOrder: i,
            createdBy: session.username,
          },
        },
        { upsert: true, new: false }
      );

      if (!result) {
        added++;
      } else {
        const needsUpdate =
          result.name !== item.productName ||
          (item.imageUrl && result.imageUrl !== item.imageUrl) ||
          result.expirationDays !== item.expirationDays;
        if (needsUpdate) updated++;
        else unchanged++;
      }
    }

    return NextResponse.json({
      ok: true,
      result: { added, updated, unchanged, total: catalog.length },
      message: `동기화 완료: 신규 ${added}개, 업데이트 ${updated}개, 변경없음 ${unchanged}개`,
    });
  } catch (error) {
    console.error("[ADMIN_SHOP_SYNC_ERROR]", error);
    return NextResponse.json(
      { ok: false, error: "동기화 실패" },
      { status: 500 }
    );
  }
}
