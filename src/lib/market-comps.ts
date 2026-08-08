/**
 * Resolve area comps from free ZHVI (zip → county) then optional RentCast zip markets.
 */

import {
  findAreaComp,
  findZipZhvi,
  formatZhviAsOf,
  getAreaCompsMeta,
  getZipZhviMeta,
  type AreaComp,
} from "@/data/area-comps";
import {
  hasRentCastKey,
  rentcastMarketByZip,
  type RentCastMarketStats,
} from "@/lib/rentcast";
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
  extra?: { zip?: string; geographyLabel?: string },
): Omit<MarketCompsSnapshot, "dealPsf" | "vsMedianPct"> {
  const meta = getAreaCompsMeta();
  const typicalSf = meta.typicalHomeSf || 1900;
  const impliedMedianHome = Math.round(comp.medianHomePsf * typicalSf);
  return {
    county: comp.county,
    state: comp.state,
    metro: comp.metro,
    zip: extra?.zip,
    geographyLabel: extra?.geographyLabel,
    medianHomePsf: comp.medianHomePsf,
    impliedMedianHome,
    avgLandPerAcre: comp.avgLandPerAcre || 0,
    zhvi: comp.zhvi,
    asOf: formatZhviAsOf(meta.asOf),
    disclaimer:
      meta.disclaimer ||
      "Area medians from free public ZHVI indices — not MLS comps or an appraisal.",
    homeSource: comp.homeSource || "zhvi",
    fhfaYoyPct: meta.fhfa?.yoyPct ?? null,
    provider: "zhvi",
  };
}

/** Sync free resolve: ZIP ZHVI first, then county table. */
export function resolveMarketCompsFree(
  input: MarketCompsResolveInput,
): MarketCompsSnapshot | null {
  const state = (input.state || "TX").toUpperCase();
  const zip = (input.zip || "").replace(/\D/g, "").slice(0, 5);
  const city = input.city?.trim() || "";

  if (zip.length === 5) {
    const z = findZipZhvi(zip);
    if (z) {
      const zmeta = getZipZhviMeta();
      return withDealMetrics(
        {
          county: input.county || guessCounty(city, state) || zip,
          state,
          metro: city || undefined,
          zip,
          geographyLabel: `ZIP ${zip}`,
          medianHomePsf: z.medianHomePsf,
          impliedMedianHome: Math.round(
            z.zhvi || z.medianHomePsf * (zmeta.typicalHomeSf || 1900),
          ),
          avgLandPerAcre: 0,
          zhvi: z.zhvi,
          asOf: formatZhviAsOf(zmeta.asOf),
          disclaimer:
            zmeta.disclaimer ||
            "ZIP ZHVI ÷ typical sf — free public research index, not MLS comps.",
          homeSource: "zhvi-zip",
          fhfaYoyPct: getAreaCompsMeta().fhfa?.yoyPct ?? null,
          provider: "zhvi-zip",
        },
        input.buildingSf,
        input.arv,
      );
    }
  }

  let resolvedCounty = input.county || guessCounty(city, state);
  if (!resolvedCounty && state === "TX") {
    if (!city || city.toLowerCase() === "houston") resolvedCounty = "Harris";
    else resolvedCounty = guessCounty(city, "TX");
  }

  if (resolvedCounty) {
    const comp = findAreaComp(resolvedCounty, state);
    if (comp) {
      return withDealMetrics(
        fromAreaComp(comp, {
          zip: zip || undefined,
          geographyLabel: `${comp.county} County, ${comp.state}`,
        }),
        input.buildingSf,
        input.arv,
      );
    }
  }

  if (city) {
    const byCity = findAreaComp(city, state);
    if (byCity) {
      return withDealMetrics(
        fromAreaComp(byCity, {
          zip: zip || undefined,
          geographyLabel: `${byCity.county} County, ${byCity.state}`,
        }),
        input.buildingSf,
        input.arv,
      );
    }
  }

  return null;
}

function fromRentCastMarket(
  zip: string,
  state: string,
  city: string,
  stats: RentCastMarketStats,
  buildingSf?: number | null,
  arv?: number | null,
): MarketCompsSnapshot | null {
  const sale = stats.saleData;
  if (!sale) return null;
  const psf =
    sale.medianPricePerSquareFoot ?? sale.averagePricePerSquareFoot ?? null;
  if (!(psf != null && psf > 0)) return null;
  const medPrice = sale.medianPrice ?? sale.averagePrice ?? null;
  const medSf = sale.medianSquareFootage ?? sale.averageSquareFootage ?? null;
  const asOfRaw = sale.lastUpdatedDate?.slice(0, 10) || null;
  return withDealMetrics(
    {
      county: zip,
      state: state || "US",
      metro: city || undefined,
      zip,
      geographyLabel: `ZIP ${zip}`,
      medianHomePsf: Math.round(psf),
      impliedMedianHome:
        medPrice != null && medPrice > 0
          ? Math.round(medPrice)
          : medSf && psf
            ? Math.round(medSf * psf)
            : null,
      avgLandPerAcre: 0,
      asOf: formatZhviAsOf(asOfRaw),
      disclaimer:
        "ZIP sale listing statistics via RentCast — active list averages, not closed MLS comps or an appraisal.",
      homeSource: "rentcast-market",
      fhfaYoyPct: null,
      provider: "rentcast",
    },
    buildingSf,
    arv,
  );
}

/** Full resolve: free ZHVI first; RentCast market only if free miss and key set. */
export async function resolveMarketCompsAsync(
  input: MarketCompsResolveInput,
): Promise<MarketCompsSnapshot | null> {
  const free = resolveMarketCompsFree(input);
  if (free) return free;

  const zip = (input.zip || "").replace(/\D/g, "").slice(0, 5);
  if (zip.length === 5 && hasRentCastKey()) {
    const stats = await rentcastMarketByZip(zip);
    if (stats) {
      const fromRc = fromRentCastMarket(
        zip,
        (input.state || "").toUpperCase(),
        input.city || "",
        stats,
        input.buildingSf,
        input.arv,
      );
      if (fromRc) return fromRc;
    }
  }

  return null;
}
