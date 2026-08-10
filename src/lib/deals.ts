import type { BuildMode, CostItem, Deal, PropertyClass } from "./types";
import { costTemplateFor } from "./types";
import { emptyProject, normalizeProject } from "./project";
import { uid } from "./underwriting";

const STORAGE_KEY = "estate.deals.v1";

export function emptyProperty() {
  return {
    name: "",
    description: "",
    address: "",
    city: "",
    state: "TX",
    zip: "",
    apn: "",
    bedrooms: null,
    bathsFull: null,
    bathsHalf: null,
    yearBuilt: null,
    buildingSf: null,
    lotSf: null,
    units: 1,
    floors: 1,
    propertyType: "Single family",
    zoning: "",
    condition: "Average",
    lastSaleAmount: null,
    lastSaleDate: "",
    taxAssessment: null,
    taxAmount: null,
  };
}

export function emptyAssumptions() {
  return {
    purchasePrice: 0,
    closingCosts: 0,
    closingCostsManual: false,
    projectMonths: 6,
    monthsToSaleOrRent: 2,
    costOfSalePct: 7,
    arv: 0,
    grossRentMonthly: 0,
    otherIncomeMonthly: 0,
    vacancyPct: 5,
    operatingExpensesMonthly: 0,
    refinance: false,
    permanentLtvPct: 75,
    permanentRatePct: 6.5,
    permanentTermYears: 30,
  };
}

/** 4% of exit value (ARV) or other $ basis unless locked by manual edit */
export function defaultClosingCosts(basis: number): number {
  return Math.round((Number(basis) || 0) * 0.04);
}

export const CLOSING_COSTS_PCT = 0.04;


export function emptyFinancing() {
  return {
    style: "all_cash" as const,
    ltvPct: 70,
    interestRatePct: 12,
    pointsPct: 2,
    termMonths: 12,
  };
}

export function templateCostItems(
  buildMode: BuildMode,
  propertyClass: PropertyClass = "residential",
): CostItem[] {
  return costTemplateFor(buildMode, propertyClass).map((row) => ({
    id: uid("cost"),
    category: row.category,
    label: row.label,
    amount: 0,
    notes: row.notes ?? "",
  }));
}

/** True when every line is blank / zero — safe to auto-swap templates. */
export function costsAreBlank(items: CostItem[]): boolean {
  if (!items.length) return true;
  return items.every((i) => !(Number(i.amount) > 0));
}

export function createDeal(partial?: Partial<Deal>): Deal {
  const now = new Date().toISOString();
  const buildMode = partial?.buildMode ?? "rehab";
  const propertyClass = partial?.propertyClass ?? "residential";
  const assumptions = { ...emptyAssumptions(), ...partial?.assumptions };
  return {
    id: partial?.id ?? uid("deal"),
    createdAt: partial?.createdAt ?? now,
    updatedAt: now,
    buildMode,
    propertyClass,
    exitStrategy: partial?.exitStrategy ?? "flip",
    property: { ...emptyProperty(), ...partial?.property },
    assumptions,
    financing: { ...emptyFinancing(), ...partial?.financing },
    costItems:
      partial?.costItems ?? templateCostItems(buildMode, propertyClass),
    project:
      partial?.project ??
      emptyProject(buildMode, assumptions.projectMonths),
    teamId: partial?.teamId ?? null,
    ownerUserId: partial?.ownerUserId ?? null,
  };
}

export function listDeals(): Deal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Deal[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeDeal)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/** Migrate older localStorage / cloud shapes (e.g. holdingCosts, missing project). */
export function normalizeDeal(raw: Deal): Deal {
  const legacy = raw.assumptions as Deal["assumptions"] & {
    holdingCosts?: number;
    closingCostsManual?: boolean;
  };
  const {
    holdingCosts: _ignored,
    ...rest
  } = {
    ...emptyAssumptions(),
    ...legacy,
  };
  void _ignored;
  const buildMode = raw.buildMode ?? "rehab";
  const assumptions = {
    ...emptyAssumptions(),
    ...rest,
    closingCostsManual: Boolean(legacy?.closingCostsManual),
  };
  return {
    ...raw,
    buildMode,
    propertyClass: raw.propertyClass ?? "residential",
    exitStrategy: raw.exitStrategy ?? "flip",
    property: { ...emptyProperty(), ...raw.property },
    assumptions,
    financing: { ...emptyFinancing(), ...raw.financing },
    costItems: Array.isArray(raw.costItems) ? raw.costItems : [],
    project: normalizeProject(
      raw.project,
      buildMode,
      assumptions.projectMonths,
    ),
    teamId: raw.teamId ?? null,
    ownerUserId: raw.ownerUserId ?? null,
  };
}

export function getDeal(id: string): Deal | null {
  return listDeals().find((d) => d.id === id) ?? null;
}

export function saveDeal(deal: Deal): Deal {
  const updated = { ...deal, updatedAt: new Date().toISOString() };
  const deals = listDeals().filter((d) => d.id !== deal.id);
  const next = [updated, ...deals];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return updated;
}

export function deleteDeal(id: string): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(listDeals().filter((d) => d.id !== id)),
  );
}

/** Write many deals into localStorage (used when pulling cloud → browser). */
export function replaceLocalDeals(deals: Deal[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      deals
        .map(normalizeDeal)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ),
  );
}

export function dealTitle(deal: Deal): string {
  return (
    deal.property.name.trim() ||
    deal.property.address.trim() ||
    "Untitled deal"
  );
}
