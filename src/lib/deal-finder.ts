import {
  type AreaComp,
  findAreaComp,
  HOME_DEAL_THRESHOLD,
  normalizeCountyKey,
} from "@/data/area-comps";
import type {
  Listing,
  ListingType,
  SampleListing,
} from "@/data/sample-listings";

export type LeadInput = {
  type: ListingType;
  price: number;
  buildingSf?: number | null;
  acres?: number | null;
  county: string;
  state?: string;
};

export type ScoreResult = {
  type: ListingType;
  /** Unit price used for comparison ($/sf or $/acre) */
  listUnitPrice: number | null;
  /** Area benchmark unit price */
  areaUnitPrice: number | null;
  /** Fraction of area (list / area). 0.5 = half of area avg */
  ratioToArea: number | null;
  /**
   * How much cheaper vs area (positive = below area).
   * e.g. 0.52 means 52% under area unit price.
   */
  discountVsArea: number | null;
  /** Pass scoring hurdle */
  isGoodDeal: boolean;
  /** Missing inputs / no comps */
  reason: string;
  areaComp: AreaComp | null;
  thresholdUsed: number;
};

export type ScoredListing = Listing & {
  score: ScoreResult;
};

/**
 * Home: listPsf = price / buildingSf.
 * Good deal if listPsf ≤ areaMedianPsf * HOME_DEAL_THRESHOLD (default 50%).
 */
export function scoreHomeDeal(
  price: number,
  buildingSf: number,
  areaMedianPsf: number,
  threshold = HOME_DEAL_THRESHOLD,
): Pick<
  ScoreResult,
  | "listUnitPrice"
  | "areaUnitPrice"
  | "ratioToArea"
  | "discountVsArea"
  | "isGoodDeal"
  | "reason"
  | "thresholdUsed"
> {
  if (!(price > 0) || !(buildingSf > 0)) {
    return {
      listUnitPrice: null,
      areaUnitPrice: areaMedianPsf > 0 ? areaMedianPsf : null,
      ratioToArea: null,
      discountVsArea: null,
      isGoodDeal: false,
      reason: "Need list price and building square feet.",
      thresholdUsed: threshold,
    };
  }
  if (!(areaMedianPsf > 0)) {
    return {
      listUnitPrice: price / buildingSf,
      areaUnitPrice: null,
      ratioToArea: null,
      discountVsArea: null,
      isGoodDeal: false,
      reason: "No area median $/sf for this county.",
      thresholdUsed: threshold,
    };
  }

  const listPsf = price / buildingSf;
  const hurdle = areaMedianPsf * threshold;
  const ratioToArea = listPsf / areaMedianPsf;
  const discountVsArea = 1 - ratioToArea;
  const isGoodDeal = listPsf <= hurdle;

  return {
    listUnitPrice: listPsf,
    areaUnitPrice: areaMedianPsf,
    ratioToArea,
    discountVsArea,
    isGoodDeal,
    reason: isGoodDeal
      ? `Unit $/sf is at least ${Math.round((1 - threshold) * 100)}% under area median (price may be assessor value, not MLS ask).`
      : `Needs unit $/sf ≤ ${Math.round(threshold * 100)}% of area median (≤ $${hurdle.toFixed(0)}/sf). Assessor value used when list price unavailable.`,
    thresholdUsed: threshold,
  };
}

/**
 * Land: listPerAcre = price / acres.
 * Good deal if listPerAcre < areaAvgPerAcre.
 */
export function scoreLandDeal(
  price: number,
  acres: number,
  areaAvgPerAcre: number,
): Pick<
  ScoreResult,
  | "listUnitPrice"
  | "areaUnitPrice"
  | "ratioToArea"
  | "discountVsArea"
  | "isGoodDeal"
  | "reason"
  | "thresholdUsed"
> {
  if (!(price > 0) || !(acres > 0)) {
    return {
      listUnitPrice: null,
      areaUnitPrice: areaAvgPerAcre > 0 ? areaAvgPerAcre : null,
      ratioToArea: null,
      discountVsArea: null,
      isGoodDeal: false,
      reason: "Need list price and acres.",
      thresholdUsed: 1,
    };
  }
  if (!(areaAvgPerAcre > 0)) {
    return {
      listUnitPrice: price / acres,
      areaUnitPrice: null,
      ratioToArea: null,
      discountVsArea: null,
      isGoodDeal: false,
      reason: "No area average $/acre for this county.",
      thresholdUsed: 1,
    };
  }

  const listPerAcre = price / acres;
  const ratioToArea = listPerAcre / areaAvgPerAcre;
  const discountVsArea = 1 - ratioToArea;
  const isGoodDeal = listPerAcre < areaAvgPerAcre;

  return {
    listUnitPrice: listPerAcre,
    areaUnitPrice: areaAvgPerAcre,
    ratioToArea,
    discountVsArea,
    isGoodDeal,
    reason: isGoodDeal
      ? "List $/acre is below area average."
      : "List $/acre is at or above area average.",
    thresholdUsed: 1,
  };
}

/** Resolve comps table (defaults or user-edited market rows). */
export function resolveAreaComp(
  county: string,
  state: string,
  comps: AreaComp[],
): AreaComp | null {
  const key = normalizeCountyKey(county);
  const st = (state || "TX").toUpperCase();
  return (
    comps.find(
      (c) =>
        normalizeCountyKey(c.county) === key && c.state.toUpperCase() === st,
    ) ?? findAreaComp(county, st)
  );
}

export function scoreLead(
  lead: LeadInput,
  comps: AreaComp[] = [],
  homeThreshold = HOME_DEAL_THRESHOLD,
): ScoreResult {
  const state = lead.state || "TX";
  const areaComp =
    comps.length > 0
      ? resolveAreaComp(lead.county, state, comps)
      : findAreaComp(lead.county, state);

  if (lead.type === "home") {
    const part = scoreHomeDeal(
      lead.price,
      Number(lead.buildingSf) || 0,
      areaComp?.medianHomePsf ?? 0,
      homeThreshold,
    );
    return {
      type: "home",
      ...part,
      areaComp,
    };
  }

  const part = scoreLandDeal(
    lead.price,
    Number(lead.acres) || 0,
    areaComp?.avgLandPerAcre ?? 0,
  );
  return {
    type: "land",
    ...part,
    areaComp,
  };
}

export function scoreListing(
  listing: Listing | SampleListing,
  comps: AreaComp[],
  homeThreshold = HOME_DEAL_THRESHOLD,
): ScoredListing {
  const score = scoreLead(
    {
      type: listing.type,
      price: listing.price,
      buildingSf: listing.buildingSf,
      acres: listing.acres,
      county: listing.county,
      state: listing.state,
    },
    comps,
    homeThreshold,
  );
  return { ...listing, score };
}

export type FinderFilters = {
  type: "all" | ListingType;
  maxPrice: number | null;
  /** Only surface listings that pass scoring hurdle */
  mustPass: boolean;
  county: string | null;
};

export function filterAndRankListings(
  listings: Array<Listing | SampleListing>,
  comps: AreaComp[],
  filters: FinderFilters,
  homeThreshold = HOME_DEAL_THRESHOLD,
): ScoredListing[] {
  const scored = listings.map((l) => scoreListing(l, comps, homeThreshold));

  return scored
    .filter((l) => {
      if (filters.type !== "all" && l.type !== filters.type) return false;
      if (filters.maxPrice != null && filters.maxPrice > 0 && l.price > filters.maxPrice)
        return false;
      if (filters.mustPass && !l.score.isGoodDeal) return false;
      if (
        filters.county &&
        normalizeCountyKey(l.county) !== normalizeCountyKey(filters.county)
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      // Good deals first, then highest discount, then lowest unit price
      if (a.score.isGoodDeal !== b.score.isGoodDeal) {
        return a.score.isGoodDeal ? -1 : 1;
      }
      const ad = a.score.discountVsArea ?? -Infinity;
      const bd = b.score.discountVsArea ?? -Infinity;
      if (bd !== ad) return bd - ad;
      const au = a.score.listUnitPrice ?? Infinity;
      const bu = b.score.listUnitPrice ?? Infinity;
      return au - bu;
    });
}

/** OpenStreetMap embed/map links from coords */
export function osmEmbedUrl(lat: number, lng: number, zoom = 14): string {
  const d = 0.02;
  const left = lng - d;
  const right = lng + d;
  const top = lat + d;
  const bottom = lat - d;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmBrowseUrl(lat: number, lng: number, zoom = 15): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

export function formatUnitPrice(
  n: number | null,
  unit: "sf" | "acre",
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 100 ? 1 : 0,
  }).format(n);
  return unit === "sf" ? `${formatted}/sf` : `${formatted}/ac`;
}

export function formatDiscount(discount: number | null): string {
  if (discount == null || !Number.isFinite(discount)) return "—";
  const pct = discount * 100;
  if (pct >= 0) return `${pct.toFixed(0)}% under area`;
  return `${Math.abs(pct).toFixed(0)}% over area`;
}
