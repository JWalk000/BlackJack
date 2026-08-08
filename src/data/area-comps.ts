/**
 * Area market benchmarks for deal screening.
 *
 * Prefer live snapshot from `npm run data:pull` (ZHVI county $/sf + CAD land medians).
 * ZIP index from ZIP ZHVI for nationwide Property-tab market panel.
 * Fall back to static Houston-metro defaults when generated file is empty.
 */

import areaCompsLive from "@/data/generated/area-comps-live.json";
import zipZhviLive from "@/data/generated/zip-zhvi-live.json";

export type AreaComp = {
  county: string;
  state: string;
  /** Approximate median improved home sale $/building sqft */
  medianHomePsf: number;
  /** Approximate average vacant land $/acre */
  avgLandPerAcre: number;
  /** Rough metro label for UI */
  metro?: string;
  zhvi?: number;
  landSource?: string;
  landSampleSize?: number;
  landNote?: string;
  homeSource?: string;
  homeNote?: string;
};

export type AreaCompsMeta = {
  provider: string | null;
  source: string | null;
  sourceUrl: string | null;
  researchPage: string | null;
  asOf: string | null;
  pulledAt: string | null;
  method: string | null;
  typicalHomeSf: number | null;
  landMethod: string | null;
  disclaimer: string | null;
  fhfa: {
    placeName?: string;
    yoyPct?: number | null;
    latest?: { year: number; period: number; index: number } | null;
  } | null;
};

export type ZipZhviHit = {
  zip: string;
  zhvi: number;
  medianHomePsf: number;
};

export type ZipZhviMeta = {
  provider: string | null;
  source: string | null;
  asOf: string | null;
  typicalHomeSf: number;
  disclaimer: string | null;
  count: number;
};

type LiveFile = {
  provider?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  researchPage?: string | null;
  asOf?: string | null;
  pulledAt?: string | null;
  method?: string | null;
  typicalHomeSf?: number | null;
  landMethod?: string | null;
  disclaimer?: string | null;
  homeDealThreshold?: number;
  counties?: Array<{
    county: string;
    state: string;
    medianHomePsf: number;
    avgLandPerAcre: number;
    metro?: string;
    zhvi?: number;
    landSource?: string;
    landSampleSize?: number;
    landNote?: string;
    homeSource?: string;
    homeNote?: string;
  }>;
  fhfa?: AreaCompsMeta["fhfa"];
};

type ZipLiveFile = {
  provider?: string | null;
  source?: string | null;
  asOf?: string | null;
  typicalHomeSf?: number | null;
  disclaimer?: string | null;
  count?: number;
  zips?: Record<string, number>;
};

const live = areaCompsLive as LiveFile;
const zipLive = zipZhviLive as ZipLiveFile;

/** Static fallback when free pull has not produced counties yet. */
const FALLBACK_AREA_COMPS: AreaComp[] = [
  {
    county: "Harris",
    state: "TX",
    medianHomePsf: 165,
    avgLandPerAcre: 185000,
    metro: "Houston",
    homeSource: "static_fallback",
    landSource: "placeholder_proxy",
  },
  {
    county: "Fort Bend",
    state: "TX",
    medianHomePsf: 172,
    avgLandPerAcre: 165000,
    metro: "Houston",
    homeSource: "static_fallback",
    landSource: "placeholder_proxy",
  },
  {
    county: "Montgomery",
    state: "TX",
    medianHomePsf: 155,
    avgLandPerAcre: 95000,
    metro: "Houston",
    homeSource: "static_fallback",
    landSource: "placeholder_proxy",
  },
  {
    county: "Brazoria",
    state: "TX",
    medianHomePsf: 142,
    avgLandPerAcre: 72000,
    metro: "Houston",
    homeSource: "static_fallback",
    landSource: "placeholder_proxy",
  },
  {
    county: "Galveston",
    state: "TX",
    medianHomePsf: 168,
    avgLandPerAcre: 88000,
    metro: "Houston",
    homeSource: "static_fallback",
    landSource: "placeholder_proxy",
  },
  {
    county: "Waller",
    state: "TX",
    medianHomePsf: 135,
    avgLandPerAcre: 45000,
    metro: "Houston",
    homeSource: "static_fallback",
    landSource: "placeholder_proxy",
  },
];

function liveCounties(): AreaComp[] {
  if (!live.counties?.length) return [];
  return live.counties.map((c) => ({
    county: c.county,
    state: c.state,
    medianHomePsf: c.medianHomePsf,
    avgLandPerAcre: c.avgLandPerAcre ?? 0,
    metro: c.metro,
    zhvi: c.zhvi,
    landSource: c.landSource,
    landSampleSize: c.landSampleSize,
    landNote: c.landNote,
    homeSource: c.homeSource,
    homeNote: c.homeNote,
  }));
}

/** Active comps table: live ZHVI/CAD when present, else fallbacks. */
export const AREA_COMPS: AreaComp[] =
  liveCounties().length > 0 ? liveCounties() : FALLBACK_AREA_COMPS;

const HOUSTON_COUNTY_KEYS = new Set([
  "harris",
  "fort bend",
  "montgomery",
  "brazoria",
  "galveston",
  "waller",
]);

/** Houston-metro subset for Deal Finder screens (not the full US list). */
export function houstonAreaComps(): AreaComp[] {
  const hit = AREA_COMPS.filter(
    (c) =>
      c.state.toUpperCase() === "TX" &&
      HOUSTON_COUNTY_KEYS.has(normalizeCountyKey(c.county)),
  );
  return hit.length > 0 ? hit : FALLBACK_AREA_COMPS;
}

export function hasLiveAreaComps(): boolean {
  return liveCounties().length > 0;
}

export function getAreaCompsMeta(): AreaCompsMeta {
  return {
    provider: live.provider ?? null,
    source: live.source ?? null,
    sourceUrl: live.sourceUrl ?? null,
    researchPage: live.researchPage ?? null,
    asOf: live.asOf ?? null,
    pulledAt: live.pulledAt ?? null,
    method: live.method ?? null,
    typicalHomeSf: live.typicalHomeSf ?? null,
    landMethod: live.landMethod ?? null,
    disclaimer: live.disclaimer ?? null,
    fhfa: live.fhfa ?? null,
  };
}

export function getZipZhviMeta(): ZipZhviMeta {
  const typical =
    typeof zipLive.typicalHomeSf === "number" && zipLive.typicalHomeSf > 0
      ? zipLive.typicalHomeSf
      : 1900;
  return {
    provider: zipLive.provider ?? null,
    source: zipLive.source ?? null,
    asOf: zipLive.asOf ?? null,
    typicalHomeSf: typical,
    disclaimer: zipLive.disclaimer ?? null,
    count: zipLive.count ?? Object.keys(zipLive.zips || {}).length,
  };
}

/** Home deal hurdle: list $/sf must be ≤ this fraction of area median. */
export const HOME_DEAL_THRESHOLD =
  typeof live.homeDealThreshold === "number" && live.homeDealThreshold > 0
    ? live.homeDealThreshold
    : 0.5;

export function normalizeCountyKey(county: string): string {
  return county
    .trim()
    .toLowerCase()
    .replace(/\s+county$/i, "")
    .replace(/\s+parish$/i, "")
    .replace(/\s+/g, " ");
}

export function findAreaComp(county: string, state = "TX"): AreaComp | null {
  const key = normalizeCountyKey(county);
  return (
    AREA_COMPS.find(
      (c) =>
        normalizeCountyKey(c.county) === key &&
        c.state.toUpperCase() === state.toUpperCase(),
    ) ?? null
  );
}

/** ZIP-level ZHVI → median $/sf using typical home size. */
export function findZipZhvi(zip: string): ZipZhviHit | null {
  const z = zip.replace(/\D/g, "").slice(0, 5);
  if (z.length !== 5) return null;
  const map = zipLive.zips || {};
  const zhvi = map[z];
  if (!(typeof zhvi === "number" && zhvi > 0)) return null;
  const typical = getZipZhviMeta().typicalHomeSf;
  return {
    zip: z,
    zhvi,
    medianHomePsf: Math.round(zhvi / typical),
  };
}

/** Default table for Deal Finder (Houston only). */
export function defaultCompsTable(): AreaComp[] {
  return houstonAreaComps().map((c) => ({ ...c }));
}

/** ZHVI period label, e.g. "Jun 2026". */
export function formatZhviAsOf(asOf?: string | null): string {
  const raw = asOf ?? getAreaCompsMeta().asOf ?? "";
  const m = String(raw).match(/^(\d{4})-(\d{2})/);
  if (!m) return raw || "—";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const mi = Number(m[2]) - 1;
  return `${months[mi] ?? m[2]} ${m[1]}`;
}

/** Convenience bundle for UI badges. */
export const AREA_COMPS_META = getAreaCompsMeta();
