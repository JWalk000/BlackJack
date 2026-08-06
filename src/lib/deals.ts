import {
  BUILD_COSTS,
  MARKETS,
  SUBMARKETS,
  type BuildCostBand,
  type MarketId,
  type ProductType,
  type Submarket,
} from "@/data/markets";
import {
  KIND_LABELS,
  OFF_MARKET_LEADS,
  type OffMarketLead,
  type OpportunityKind,
} from "@/data/offmarket-leads";

export type DealInputs = {
  marketId: MarketId;
  productType: ProductType;
  /** Required profit on sellout after build + land */
  targetMarginPct: number;
  /** Optional hard-cost override ($/sf) */
  hardCostOverride?: number;
  /** Max miles from market anchor */
  maxMiles?: number;
};

export type DealResult = {
  submarket: Submarket;
  productLabel: string;
  hardCostPsf: number;
  allInBuildPsf: number;
  salePsf: number;
  landPsf: number;
  residualPsf: number;
  marginPct: number;
  supportableLandPsf: number;
  landCushionPsf: number;
  passes: boolean;
  score: number;
  thesis: string;
};

export type OffMarketInputs = DealInputs & {
  kinds?: OpportunityKind[];
  /** Prefer leads that are not listed (all sample leads are off-market) */
  offMarketOnly?: boolean;
  requireAbsenteeOrEstate?: boolean;
};

export type OffMarketResult = {
  lead: OffMarketLead;
  submarket: Submarket;
  productLabel: string;
  kindLabel: string;
  allInBuildPsf: number;
  salePsf: number;
  /** Site basis $/buildable sf assumption using lot (vacant) or teardown basis */
  siteBasisPsf: number;
  /** Demo/soft site cost for teardowns */
  demoAllowance: number;
  supportableSiteBudget: number;
  residualAfterSite: number;
  marginPct: number;
  passes: boolean;
  score: number;
  thesis: string;
  signals: string[];
};

function bandFor(
  marketId: MarketId,
  productType: ProductType,
): BuildCostBand | undefined {
  return BUILD_COSTS.find(
    (b) => b.marketId === marketId && b.productType === productType,
  );
}

export function allInBuildPsf(band: BuildCostBand, hardOverride?: number) {
  const hard = hardOverride ?? band.hardCostPsf;
  return hard * (1 + band.softPct) * (1 + band.contingencyPct);
}

function submarketById(id: string) {
  return SUBMARKETS.find((s) => s.id === id);
}

/** Rough buildable finished sf from lot — density proxy by product */
export function finishedSfCapacity(
  lead: Pick<OffMarketLead, "lotSf" | "livingSf">,
  productType: ProductType,
) {
  // Prefer recorded living area when present (teardown / rehab)
  if (lead.livingSf != null && lead.livingSf >= 400 && lead.livingSf <= 12000) {
    if (
      productType === "for_sale_sf" ||
      productType === "btr_sf" ||
      productType === "duplex_quad" ||
      productType === "townhome"
    ) {
      return Math.round(lead.livingSf);
    }
  }

  const lot = Math.max(lead.lotSf || 0, 0);

  if (productType === "for_sale_sf" || productType === "btr_sf") {
    // One house-scale building; cap to typical home footprint
    return Math.round(Math.min(Math.max(lot * 0.28, 1200), 3500));
  }
  if (productType === "duplex_quad") {
    return Math.round(Math.min(Math.max(lot * 0.32, 1600), 5000));
  }
  if (productType === "townhome") {
    const coverage = 0.4;
    const stories = 2;
    return Math.round(
      Math.min(Math.max(lot * coverage * (stories * 0.45), 1400), 12000),
    );
  }
  const coverage = productType === "midrise_mf" ? 0.55 : 0.35;
  const stories = productType === "midrise_mf" ? 4 : 3;
  return Math.round(
    Math.min(Math.max(lot * coverage * (stories * 0.45), 1200), 250000),
  );
}

function siteAcquisitionCost(lead: OffMarketLead) {
  const demo =
    lead.kind === "teardown" || lead.kind === "underimproved"
      ? Math.max(15000, (lead.livingSf ?? 1000) * 8)
      : 0;
  return { basis: lead.askingOrAssessed, demo, total: lead.askingOrAssessed + demo };
}

function leadSignals(lead: OffMarketLead): string[] {
  const signals: string[] = ["Not listed (off-market)"];
  if (lead.kind === "vacant_land") signals.push("Vacant / land-only");
  if (lead.kind === "teardown") signals.push("Teardown / rebuild");
  if (lead.kind === "underimproved") signals.push("Underimproved");
  if (lead.absenteeOwner) signals.push("Absentee owner");
  if (lead.ownerType === "estate") signals.push("Estate");
  if (lead.ownerType === "trust") signals.push("Trust");
  if (lead.ownerType === "llc") signals.push("LLC holder");
  if (lead.ownerType === "out_of_state") signals.push("Out-of-state owner");
  if (lead.taxDelinquent) signals.push("Tax delinquent");
  if (lead.yearsOwned >= 20) signals.push(`Held ${lead.yearsOwned}+ yrs`);
  const improvRatio =
    lead.landValue > 0 ? lead.improvementValue / lead.landValue : 0;
  if (lead.improvementValue > 0 && improvRatio < 0.25) {
    signals.push("Improvement << land value");
  }
  return signals;
}

export function scoreDeals(inputs: DealInputs): DealResult[] {
  const band = bandFor(inputs.marketId, inputs.productType);
  if (!band) return [];

  const build = allInBuildPsf(band, inputs.hardCostOverride);
  const maxMiles = inputs.maxMiles ?? Infinity;
  const target = inputs.targetMarginPct / 100;

  return SUBMARKETS.filter(
    (s) =>
      s.marketId === inputs.marketId && s.milesFromAnchor <= maxMiles,
  )
    .map((s) => {
      const residualPsf = s.salePsf - build - s.landPsf;
      const marginPct = residualPsf / s.salePsf;
      const supportableLandPsf = s.salePsf * (1 - target) - build;
      const landCushionPsf = supportableLandPsf - s.landPsf;
      const passes = marginPct >= target && landCushionPsf >= 0;

      const score =
        marginPct * 100 +
        Math.min(landCushionPsf, 80) * 0.35 -
        s.milesFromAnchor * 0.05;

      let thesis: string;
      if (passes) {
        thesis = `Exit ~$${Math.round(s.salePsf)}/sf vs all-in build ~$${Math.round(build)}/sf leaves ~${(marginPct * 100).toFixed(0)}% after typical land — clears ${(target * 100).toFixed(0)}% hurdle.`;
      } else if (supportableLandPsf < 0) {
        thesis = `Build cost alone exceeds what a ${(target * 100).toFixed(0)}% margin allows at local sale prices — product/cost mismatch.`;
      } else if (landCushionPsf < 0) {
        thesis = `Sale supports only ~$${Math.round(supportableLandPsf)}/sf for land; typical land here is ~$${Math.round(s.landPsf)}/sf — need cheaper dirt or higher rents/sales.`;
      } else {
        thesis = `Margin ${(marginPct * 100).toFixed(0)}% is below your ${(target * 100).toFixed(0)}% target.`;
      }

      return {
        submarket: s,
        productLabel: band.label,
        hardCostPsf: inputs.hardCostOverride ?? band.hardCostPsf,
        allInBuildPsf: build,
        salePsf: s.salePsf,
        landPsf: s.landPsf,
        residualPsf,
        marginPct,
        supportableLandPsf,
        landCushionPsf,
        passes,
        score,
        thesis,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function scoreOffMarketLeads(
  inputs: OffMarketInputs,
  leadPool: OffMarketLead[] = OFF_MARKET_LEADS,
): OffMarketResult[] {
  const band = bandFor(inputs.marketId, inputs.productType);
  if (!band) return [];

  const build = allInBuildPsf(band, inputs.hardCostOverride);
  const maxMiles = inputs.maxMiles ?? Infinity;
  const target = inputs.targetMarginPct / 100;
  const kinds = inputs.kinds?.length
    ? new Set(inputs.kinds)
    : null;

  return leadPool.filter((lead) => {
    if (lead.marketId !== inputs.marketId) return false;
    if (lead.milesFromAnchor > maxMiles) return false;
    if (inputs.offMarketOnly !== false && lead.listedForSale) return false;
    if (kinds && !kinds.has(lead.kind)) return false;
    if (
      inputs.requireAbsenteeOrEstate &&
      !(
        lead.absenteeOwner ||
        lead.ownerType === "estate" ||
        lead.ownerType === "trust" ||
        lead.taxDelinquent
      )
    ) {
      return false;
    }
    return true;
  })
    .map((lead) => {
      const sub = submarketById(lead.submarketId);
      if (!sub) return null;

      const capacity = finishedSfCapacity(lead, inputs.productType);
      const site = siteAcquisitionCost(lead);
      const siteBasisPsf = site.total / capacity;
      const sellout = capacity * sub.salePsf;
      const buildCost = capacity * build;
      const residualAfterSite = sellout - buildCost - site.total;
      const marginPct = residualAfterSite / sellout;
      const supportableSiteBudget = sellout * (1 - target) - buildCost;
      const passes =
        marginPct >= target && site.total <= supportableSiteBudget;

      const cheapLandBonus =
        lead.kind === "vacant_land" ? 8 : lead.kind === "teardown" ? 6 : 4;
      const offMarketBonus =
        (lead.absenteeOwner ? 5 : 0) +
        (lead.ownerType === "estate" ? 6 : 0) +
        (lead.taxDelinquent ? 4 : 0) +
        (lead.yearsOwned >= 20 ? 3 : 0);

      const score =
        marginPct * 100 +
        cheapLandBonus +
        offMarketBonus +
        Math.min((supportableSiteBudget - site.total) / 10000, 20) -
        lead.milesFromAnchor * 0.04;

      let thesis: string;
      if (passes) {
        thesis = `At ~${Math.round(capacity).toLocaleString()} finished sf and ${KIND_LABELS[lead.kind].toLowerCase()} basis ${formatMoney(site.total)}, exit in ${sub.name} supports ~${(marginPct * 100).toFixed(0)}% after build — off-market site clears your hurdle.`;
      } else if (site.total > supportableSiteBudget) {
        thesis = `Site basis ${formatMoney(site.total)} is above the ~${formatMoney(supportableSiteBudget)} this product can pay in ${sub.name}. Negotiate down, change product, or pass.`;
      } else {
        thesis = `Margin ${(marginPct * 100).toFixed(0)}% is under your ${(target * 100).toFixed(0)}% target at current exit / cost assumptions.`;
      }

      return {
        lead,
        submarket: sub,
        productLabel: band.label,
        kindLabel: KIND_LABELS[lead.kind],
        allInBuildPsf: build,
        salePsf: sub.salePsf,
        siteBasisPsf,
        demoAllowance: site.demo,
        supportableSiteBudget,
        residualAfterSite,
        marginPct,
        passes,
        score,
        thesis,
        signals: leadSignals(lead),
      } satisfies OffMarketResult;
    })
    .filter((r): r is OffMarketResult => r !== null)
    .sort((a, b) => b.score - a.score);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function getMarketMeta(id: MarketId) {
  return MARKETS[id];
}

export function productOptions(marketId: MarketId) {
  return BUILD_COSTS.filter((b) => b.marketId === marketId);
}
