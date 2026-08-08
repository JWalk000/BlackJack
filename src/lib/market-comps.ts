/**
 * Free market comps: ZIP ZHVI first, then county ZHVI table.
 * No paid APIs required.
 */

import {
  findAreaComp,
  findZipZhvi,
  formatZhviAsOf,
  getAreaCompsMeta,
  getZipZhviMeta,
  type AreaComp,
} from "@/data/area-comps";
import { guessCounty } from "@/lib/tx-counties";

export type MarketCompsSnapshot = {
  county: string;
  state: string;
  metro?: string;
  zip?: string;
  geographyLabel?: string;
  medianHomePsf: number;
  impliedMedianHome?: number | null;
  avgLandPerAcre: number;
  zhvi?: number;
  asOf: string;
  disclaimer: string;
  homeSource?: string;
  fhfaYoyPct?: number | null;
  dealPsf?: number | null;
  vsMedianPct?: number | null;
  provider?: string;
};

export type MarketCompsResolveInput = {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  buildingSf?: number | null;
  arv?: number | null;
};

function withDealMetrics(
  base: Omit<MarketCompsSnapshot, "dealPsf" | "vsMedianPct">,
  buildingSf?: number | null,
  arv?: number | null,
): MarketCompsSnapshot {
  const dealPsf =
    buildingSf && buildingSf > 0 && arv != null && arv > 0
      ? arv / buildingSf
      : null;
  const vsMedianPct =
    dealPsf != null && base.medianHomePsf > 0
      ? ((dealPsf - base.medianHomePsf) / base.medianHomePsf) * 100
      : null;
  return { ...base, dealPsf, vsMedianPct };
}

function fromAreaComp(
  comp: AreaComp,
  buildingSf?: number | null,
  arv?: number | null,
  extra?: { zip?: string; geographyLabel?: string; provider?: string },
): MarketCompsSnapshot {
  const meta = getAreaCompsMeta();
  const typicalSf = meta.typicalHomeSf || 1900;
  return withDealMetrics(
    {
      county: comp.county,
      state: comp.state,
      metro: comp.metro,
      zip: extra?.zip,
      geographyLabel:
        extra?.geographyLabel ||
        `${comp.county} County, ${comp.state}`,
      medianHomePsf: comp.medianHomePsf,
      impliedMedianHome: Math.round(comp.medianHomePsf * typicalSf),
      avgLandPerAcre: comp.avgLandPerAcre || 0,
      zhvi: comp.zhvi,
      asOf: formatZhviAsOf(meta.asOf),
      disclaimer:
        meta.disclaimer ||
        "Area medians from free public indices — not MLS comps or an appraisal.",
      homeSource: comp.homeSource || "zhvi",
      fhfaYoyPct: meta.fhfa?.yoyPct ?? null,
      provider: extra?.provider || "zhvi",
    },
    buildingSf,
    arv,
  );
}

/** ZIP ZHVI → county table. Default Harris TX when only TX-ish context. */
export function resolveMarketCompsFree(
  input: MarketCompsResolveInput,
): MarketCompsSnapshot | null {
  const state = (input.state || "TX").toUpperCase() || "TX";
  const zip = (input.zip || "").replace(/\D/g, "").slice(0, 5);
  const buildingSf = input.buildingSf;
  const arv = input.arv;

  if (zip.length === 5) {
    const hit = findZipZhvi(zip);
    if (hit) {
      const zipMeta = getZipZhviMeta();
      const county =
        input.county ||
        guessCounty(input.city || "", state) ||
        "Harris";
      return withDealMetrics(
        {
          county,
          state,
          zip,
          geographyLabel: `ZIP ${zip}`,
          medianHomePsf: hit.medianHomePsf,
          impliedMedianHome: Math.round(hit.zhvi),
          avgLandPerAcre: 0,
          zhvi: hit.zhvi,
          asOf: formatZhviAsOf(zipMeta.asOf || getAreaCompsMeta().asOf),
          disclaimer:
            zipMeta.disclaimer ||
            "ZIP ZHVI home value ÷ typical SF — not MLS comps or an appraisal.",
          homeSource: "zhvi-zip",
          fhfaYoyPct: getAreaCompsMeta().fhfa?.yoyPct ?? null,
          provider: "zhvi-zip",
        },
        buildingSf,
        arv,
      );
    }
  }

  const county =
    input.county ||
    guessCounty(input.city || "", state) ||
    (state === "TX" ? "Harris" : null);
  if (!county) return null;
  const comp = findAreaComp(county, state);
  if (!comp) {
    // Default Houston metro if TX city not in table
    const harris = findAreaComp("Harris", "TX");
    if (!harris) return null;
    return fromAreaComp(harris, buildingSf, arv, {
      geographyLabel: `${county}-area (using Harris $/sf table)`,
      provider: "zhvi",
    });
  }
  return fromAreaComp(comp, buildingSf, arv);
}

/** Async entry for API routes; free ZHVI only (paid providers optional later). */
export async function resolveMarketCompsAsync(
  input: MarketCompsResolveInput,
): Promise<MarketCompsSnapshot | null> {
  return resolveMarketCompsFree(input);
}
