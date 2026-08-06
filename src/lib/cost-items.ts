import { uid } from "@/lib/id";
import type { CostItemCategory, CostLineItem } from "@/lib/types";

export type ScopeKind = "rehab" | "new_build";

export const COST_CATEGORY_LABELS: Record<CostItemCategory, string> = {
  demolition: "Demo / prep",
  structure: "Structure",
  envelope: "Envelope",
  mechanical: "MEP",
  interior: "Interior",
  kitchens: "Kitchen",
  baths: "Baths",
  exterior: "Exterior / site",
  site: "Site work",
  soft: "Soft costs",
  contingency: "Contingency",
  other: "Other",
};

export const COST_CATEGORIES = Object.keys(
  COST_CATEGORY_LABELS,
) as CostItemCategory[];

type TemplateLine = {
  category: CostItemCategory;
  name: string;
  /** Share of total budget (sums ≈ 1) */
  share: number;
  notes?: string;
};

/** Typical light-moderate SF remodel stack */
const REHAB_TEMPLATE: TemplateLine[] = [
  {
    category: "demolition",
    name: "Demo, trash-out & protection",
    share: 0.05,
  },
  {
    category: "structure",
    name: "Structural / foundation repair",
    share: 0.08,
  },
  {
    category: "envelope",
    name: "Roof, siding, windows, weatherproofing",
    share: 0.12,
  },
  {
    category: "mechanical",
    name: "Electrical",
    share: 0.08,
  },
  {
    category: "mechanical",
    name: "Plumbing",
    share: 0.08,
  },
  {
    category: "mechanical",
    name: "HVAC",
    share: 0.07,
  },
  {
    category: "kitchens",
    name: "Kitchen remodel",
    share: 0.12,
  },
  {
    category: "baths",
    name: "Bath remodel",
    share: 0.1,
  },
  {
    category: "interior",
    name: "Flooring, drywall & finishes",
    share: 0.12,
  },
  {
    category: "interior",
    name: "Paint, trim & doors",
    share: 0.06,
  },
  {
    category: "exterior",
    name: "Exterior + landscaping punch",
    share: 0.05,
  },
  {
    category: "soft",
    name: "Permits, design & GC fee",
    share: 0.04,
  },
  {
    category: "contingency",
    name: "Contingency",
    share: 0.03,
  },
];

/** New build / full reconstruction development stack */
const NEW_BUILD_TEMPLATE: TemplateLine[] = [
  {
    category: "site",
    name: "Site work, utilities & grading",
    share: 0.1,
  },
  {
    category: "structure",
    name: "Foundation & structure",
    share: 0.18,
  },
  {
    category: "envelope",
    name: "Envelope (roof, walls, windows)",
    share: 0.12,
  },
  {
    category: "mechanical",
    name: "MEP (elec / plumbing / HVAC)",
    share: 0.16,
  },
  {
    category: "interior",
    name: "Interior finishes",
    share: 0.14,
  },
  {
    category: "kitchens",
    name: "Kitchens",
    share: 0.06,
  },
  {
    category: "baths",
    name: "Baths",
    share: 0.05,
  },
  {
    category: "exterior",
    name: "Exterior hardscape & finish",
    share: 0.05,
  },
  {
    category: "soft",
    name: "Architecture, engineering & fees",
    share: 0.06,
  },
  {
    category: "soft",
    name: "Permits & impact fees",
    share: 0.03,
  },
  {
    category: "contingency",
    name: "Contingency",
    share: 0.05,
  },
];

function templateFor(scope: ScopeKind): TemplateLine[] {
  return scope === "new_build" ? NEW_BUILD_TEMPLATE : REHAB_TEMPLATE;
}

export function sumCostItems(items: CostLineItem[] | undefined | null): number {
  if (!items?.length) return 0;
  return items.reduce((s, i) => s + Math.max(0, Number(i.amount) || 0), 0);
}

export function sanitizeCostItems(
  items: CostLineItem[] | undefined | null,
): CostLineItem[] | undefined {
  if (!items?.length) return undefined;
  return items.map((item) => ({
    id: item.id || uid("cost"),
    category: COST_CATEGORIES.includes(item.category)
      ? item.category
      : "other",
    name: (item.name || "Line item").trim() || "Line item",
    amount: Math.max(0, Math.round(Number(item.amount) || 0)),
    notes: item.notes?.trim() || undefined,
  }));
}

/** Distribute a target total across share template; last line absorbs rounding. */
export function buildTemplateItems(
  scope: ScopeKind,
  totalBudget: number,
): CostLineItem[] {
  const total = Math.max(0, Math.round(totalBudget));
  const template = templateFor(scope);
  const shareSum = template.reduce((s, t) => s + t.share, 0);
  let allocated = 0;
  const lines: CostLineItem[] = template.map((t, idx) => {
    const isLast = idx === template.length - 1;
    let amount = isLast
      ? Math.max(0, total - allocated)
      : Math.round((total * t.share) / shareSum);
    if (!isLast) allocated += amount;
    return {
      id: uid("cost"),
      category: t.category,
      name: t.name,
      amount,
      notes: t.notes,
    };
  });
  return lines;
}

/** Scale existing line amounts proportionally to a new total. */
export function scaleCostItems(
  items: CostLineItem[],
  totalBudget: number,
): CostLineItem[] {
  const total = Math.max(0, Math.round(totalBudget));
  const current = sumCostItems(items);
  if (items.length === 0) return [];
  if (current <= 0) {
    const each = Math.floor(total / items.length);
    let left = total - each * items.length;
    return items.map((item, i) => ({
      ...item,
      amount: each + (i === items.length - 1 ? left : 0),
    }));
  }
  let allocated = 0;
  return items.map((item, idx) => {
    const isLast = idx === items.length - 1;
    const amount = isLast
      ? Math.max(0, total - allocated)
      : Math.round((item.amount / current) * total);
    if (!isLast) allocated += amount;
    return { ...item, amount };
  });
}

export function emptyCostLine(
  category: CostItemCategory = "other",
): CostLineItem {
  return {
    id: uid("cost"),
    category,
    name: "",
    amount: 0,
  };
}

export function groupCostItemsByCategory(items: CostLineItem[]) {
  const map = new Map<CostItemCategory, CostLineItem[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

export function categorySubtotal(
  items: CostLineItem[],
  category: CostItemCategory,
): number {
  return sumCostItems(items.filter((i) => i.category === category));
}
