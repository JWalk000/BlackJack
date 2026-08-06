import type { OffMarketLead } from "@/data/offmarket-leads";
import { BUILD_COSTS, type ProductType } from "@/data/markets";
import type { PropertyInfo, UnderwritingAssumptions } from "@/lib/types";
import {
  defaultPropertyInfo,
  defaultUnderwriting,
  regionalBuildCosts,
  sanitizeUnderwriting,
} from "@/lib/underwriting";
import { buildTemplateItems } from "@/lib/cost-items";
import { finishedSfCapacity } from "@/lib/deals";

const PENDING_KEY = "estate.pendingDeal";

export type PendingDeal = {
  lead: OffMarketLead;
  productType: ProductType;
  productLabel: string;
  marginPct: number;
  thesis: string;
  kindLabel: string;
  salePsf: number;
  allInBuildPsf: number;
  targetMarginPct: number;
};

export function savePendingDeal(deal: PendingDeal) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(deal));
}

export function loadPendingDeal(): PendingDeal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingDeal;
  } catch {
    return null;
  }
}

export function clearPendingDeal() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_KEY);
}

function stateForMarket(marketId: OffMarketLead["marketId"]): string {
  return marketId === "houston" ? "TX" : "VA";
}

function propertyTypeForProduct(productType: ProductType): string {
  switch (productType) {
    case "for_sale_sf":
    case "btr_sf":
      return "Single Family";
    case "duplex_quad":
      return "Multifamily 2-4";
    case "townhome":
      return "Townhome";
    case "garden_mf":
    case "midrise_mf":
      return "Multifamily";
    default:
      return "Single Family";
  }
}

/** Prefill property record from a real (or sample) off-market lead */
export function propertyFromDeal(deal: PendingDeal): PropertyInfo {
  const { lead, productType, productLabel, kindLabel } = deal;
  const finishedSf = finishedSfCapacity(lead, productType);
  return {
    ...defaultPropertyInfo(lead.address, lead.address),
    propertyName: lead.address,
    description: `${kindLabel} · ${productLabel}. ${lead.whyOffMarket}`,
    address: lead.address,
    city: lead.city,
    state: stateForMarket(lead.marketId),
    zip: "",
    apn: lead.apn,
    ownerName: "",
    ownerMailing: lead.ownerMailingHint,
    beds: null,
    baths: null,
    sqft: finishedSf,
    yearBuilt: lead.yearBuilt,
    units:
      productType === "garden_mf" || productType === "midrise_mf"
        ? 48
        : productType === "duplex_quad"
          ? 2
          : 1,
    propertyType: propertyTypeForProduct(productType),
    lotAcres: lead.acres || null,
    lotSf: lead.lotSf || null,
    zoning: "",
    ownerOccupied: !lead.absenteeOwner,
    estValue: lead.askingOrAssessed,
    lastSaleAmount: null,
    lastSaleDate: "",
    taxAssessment: lead.askingOrAssessed,
    landValue: lead.landValue,
    improvementValue: lead.improvementValue,
    taxYear: new Date().getFullYear().toString(),
  };
}

/**
 * Prefill underwriting from a scored Deal Finder lead.
 * ARV is anchored to finished sf × sale $/sf, then sanitized so ROI cannot explode.
 */
export function underwritingFromDeal(
  deal: PendingDeal,
): UnderwritingAssumptions {
  const land = deal.lead.landValue || deal.lead.askingOrAssessed;
  const purchase = Math.round(
    deal.lead.askingOrAssessed > 0 ? deal.lead.askingOrAssessed : land,
  );

  const finishedSf = finishedSfCapacity(deal.lead, deal.productType);
  const band = BUILD_COSTS.find(
    (b) =>
      b.marketId === deal.lead.marketId && b.productType === deal.productType,
  );
  const hardPsf = band?.hardCostPsf ?? Math.round(deal.allInBuildPsf / 1.2);
  const softPct = band?.softPct ?? 0.12;
  const contPct = band?.contingencyPct ?? 0.07;
  const costs = regionalBuildCosts(finishedSf, hardPsf, softPct, contPct);

  const isLightRehab =
    deal.lead.kind === "teardown" || deal.lead.kind === "underimproved";
  const rehabBudget = isLightRehab
    ? costs.rehabProxy
    : Math.round(costs.total);
  const itemScope =
    deal.lead.kind === "vacant_land" || !isLightRehab
      ? "new_build"
      : "rehab";
  const costItems = buildTemplateItems(itemScope, rehabBudget);

  // Exit: product finish × submarket sale/sf — never lot-bank sellout
  let arv = Math.round(finishedSf * deal.salePsf);
  const into = purchase + rehabBudget;
  // Realistic flip band: 1.2×–2.0× into money for residential product
  if (
    deal.productType === "for_sale_sf" ||
    deal.productType === "btr_sf" ||
    deal.productType === "duplex_quad" ||
    deal.productType === "townhome"
  ) {
    const minArv = Math.round(into * 1.15);
    const maxArv = Math.round(into * 2.0);
    arv = Math.min(Math.max(arv, minArv), maxArv);
  }

  const monthsTotal =
    deal.lead.kind === "vacant_land"
      ? 12
      : isLightRehab
        ? 6
        : 10;
  const rehabMonths = Math.max(1, Math.floor(monthsTotal / 2));
  const monthsToSale = Math.max(1, monthsTotal - rehabMonths);

  return sanitizeUnderwriting(
    defaultUnderwriting({
      purchasePrice: purchase,
      closingCosts: Math.round(purchase * 0.02),
      holdingCosts: Math.round(purchase * 0.015),
      rehabBudget,
      costItems,
      rehabMonths,
      financing: "all-cash",
      downPaymentPct: 100,
      arv,
      resalePrice: arv,
      monthsToSale,
      costOfSalePct: 6,
      monthlyRent: Math.max(1200, Math.round(arv * 0.0055)),
      monthlyExpenses: Math.max(400, Math.round(arv * 0.0015)),
      monthsToRent: deal.lead.kind === "vacant_land" ? 12 : 3,
      refinance:
        deal.productType === "btr_sf" || deal.productType.includes("mf"),
    }),
  );
}

export function finishedSfFromDeal(deal: PendingDeal): number {
  return finishedSfCapacity(deal.lead, deal.productType);
}

export function regionLabel(marketId: OffMarketLead["marketId"]): string {
  return marketId === "houston"
    ? "Houston + 100 mi"
    : "Northern VA → Richmond";
}
