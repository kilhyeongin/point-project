import { PartnerCategoryMaster } from "@/models/PartnerCategory";

export type CategoryOption = {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  isVisibleToPartner: boolean;
  isVisibleToCustomer: boolean;
  sortOrder: number;
};

export const DEFAULT_PARTNER_CATEGORY_SEEDS: CategoryOption[] = [
  { code: "DRESS", name: "드레스", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 10 },
  { code: "MAKEUP", name: "메이크업", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 20 },
  { code: "STUDIO", name: "스튜디오", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 30 },
  { code: "HANBOK", name: "한복", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 40 },
  { code: "JEWELRY", name: "예물", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 50 },
  { code: "TRAVEL", name: "여행", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 60 },
  { code: "VIDEO", name: "영상", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 70 },
  { code: "BOUQUET", name: "부케", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 80 },
  { code: "SNAP", name: "스냅", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 90 },
  { code: "INVITATION", name: "청첩장", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 100 },
  { code: "MC", name: "사회자", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 110 },
  { code: "BAND", name: "밴드", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 120 },
  { code: "GIFT", name: "답례품", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 130 },
  { code: "ETC", name: "기타", description: "", isActive: true, isVisibleToPartner: true, isVisibleToCustomer: true, sortOrder: 140 },
];

export function normalizeCategoryCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 50);
}

const LEGACY_LABEL_TO_CODE: Record<string, string> = Object.fromEntries(
  DEFAULT_PARTNER_CATEGORY_SEEDS.map((item) => [item.name, item.code])
);

export async function ensureDefaultPartnerCategories() {
  const count = await PartnerCategoryMaster.countDocuments({});
  if (count > 0) return;

  await PartnerCategoryMaster.insertMany(
    DEFAULT_PARTNER_CATEGORY_SEEDS.map((item) => ({
      ...item,
      createdBy: "SYSTEM",
      updatedBy: "SYSTEM",
    })),
    { ordered: false }
  ).catch(() => undefined);
}

export async function getPartnerCategoryMasters(options?: {
  activeOnly?: boolean;
  visibleToPartnerOnly?: boolean;
  visibleToCustomerOnly?: boolean;
}) {
  await ensureDefaultPartnerCategories();

  const filter: Record<string, unknown> = {};

  if (options?.activeOnly) filter.isActive = true;
  if (options?.visibleToPartnerOnly) filter.isVisibleToPartner = true;
  if (options?.visibleToCustomerOnly) filter.isVisibleToCustomer = true;

  const docs = await PartnerCategoryMaster.find(filter)
    .sort({ sortOrder: 1, name: 1, createdAt: 1 })
    .lean();

  return (docs as any[]).map((doc) => ({
    id: String(doc._id),
    code: String(doc.code ?? ""),
    name: String(doc.name ?? ""),
    description: String(doc.description ?? ""),
    isActive: Boolean(doc.isActive),
    isVisibleToPartner: Boolean(doc.isVisibleToPartner),
    isVisibleToCustomer: Boolean(doc.isVisibleToCustomer),
    sortOrder: Number(doc.sortOrder ?? 0),
  }));
}

export async function getPartnerCategoryMap() {
  const items = await getPartnerCategoryMasters();
  const map = new Map<string, string>();

  for (const item of items) {
    map.set(item.code, item.name);
  }

  for (const item of DEFAULT_PARTNER_CATEGORY_SEEDS) {
    if (!map.has(item.code)) {
      map.set(item.code, item.name);
    }
  }

  return map;
}

export async function normalizeCategoryCodes(
  values: unknown,
  legacyCategory?: unknown,
  options?: { onlyActive?: boolean; visibleToPartnerOnly?: boolean; visibleToCustomerOnly?: boolean }
) {
  const items = await getPartnerCategoryMasters({
    activeOnly: options?.onlyActive,
    visibleToPartnerOnly: options?.visibleToPartnerOnly,
    visibleToCustomerOnly: options?.visibleToCustomerOnly,
  });

  const allowed = new Set(items.map((item) => item.code));
  const seedAllowed = new Set(DEFAULT_PARTNER_CATEGORY_SEEDS.map((item) => item.code));
  const set = new Set<string>();

  const append = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return;

    const legacyMapped = LEGACY_LABEL_TO_CODE[raw];
    const normalized = normalizeCategoryCode(legacyMapped || raw);
    if (!normalized) return;

    if (allowed.size > 0) {
      if (allowed.has(normalized)) set.add(normalized);
      return;
    }

    if (seedAllowed.has(normalized)) {
      set.add(normalized);
    }
  };

  if (Array.isArray(values)) {
    for (const value of values) append(value);
  }

  append(legacyCategory);

  return Array.from(set);
}

export async function getCategoryLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "기타";

  const mapped = LEGACY_LABEL_TO_CODE[raw] || normalizeCategoryCode(raw);
  const map = await getPartnerCategoryMap();
  return map.get(mapped) ?? raw ?? "기타";
}

export async function getCategoryLabels(values: unknown[]) {
  const map = await getPartnerCategoryMap();

  return values.map((value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "기타";
    const mapped = LEGACY_LABEL_TO_CODE[raw] || normalizeCategoryCode(raw);
    return map.get(mapped) ?? raw;
  });
}