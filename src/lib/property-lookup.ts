/**
 * Free property lookup for deal autofill.
 * Prefer free-leads CAD cache; optionally live HCAD/FBCAD address match;
 * Census geocoder for US address parse; ZHVI area comps for market context.
 * ATTOM-ready: swap provider later without changing PropertyInfo fields.
 */

import type { PropertyInfo } from "@/lib/types";
import {
  getFinderInventory,
  getFreeCadListings,
  type FreeLeadListing,
} from "@/data/listings";
import {
  findAreaComp,
  formatZhviAsOf,
  getAreaCompsMeta,
  type AreaComp,
} from "@/data/area-comps";

export type PropertySuggestion = {
  id: string;
  label: string;
  address: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  provider?: string;
  /** Assessed / market value when known */
  taxAssessment?: number | null;
  buildingSf?: number | null;
  lotSf?: number | null;
  yearBuilt?: number | null;
  apn?: string;
  source: "free-cad" | "hcad-live" | "fbcad-live" | "sample" | "census";
  notes?: string;
};

export type MarketCompsSnapshot = {
  county: string;
  state: string;
  metro?: string;
  medianHomePsf: number;
  /** Implied median home ~ typical SF × $/sf when ZHVI/typical SF known */
  impliedMedianHome?: number | null;
  avgLandPerAcre: number;
  zhvi?: number;
  asOf: string;
  disclaimer: string;
  homeSource?: string;
  fhfaYoyPct?: number | null;
  /** Deal ARV vs county $/sf for building sf */
  dealPsf?: number | null;
  vsMedianPct?: number | null;
};

const CITY_COUNTY: Record<string, string> = {
  houston: "Harris",
  pasadena: "Harris",
  "bellaire": "Harris",
  "west university place": "Harris",
  "west u": "Harris",
  spring: "Harris",
  cypress: "Harris",
  kite: "Harris",
  kate: "Harris",
  kaly: "Harris",
  katy: "Harris",
  humble: "Harris",
  baytown: "Harris",
  "jersey village": "Harris",
  tomball: "Harris",
  alief: "Harris",
  sugarland: "Fort Bend",
  "sugar land": "Fort Bend",
  missouri: "Fort Bend",
  "missouri city": "Fort Bend",
  stafford: "Fort Bend",
  richmond: "Fort Bend",
  rosenberg: "Fort Bend",
  "the woodlands": "Montgomery",
  conroe: "Montgomery",
  magnolia: "Montgomery",
  pearland: "Brazoria",
  alvin: "Brazoria",
  league: "Galveston",
  "league city": "Galveston",
  galveston: "Galveston",
  friendswood: "Galveston",
  waller: "Waller",
  brookshire: "Waller",
};

export function guessCounty(city: string, state = "TX"): string | null {
  if (!city || state.toUpperCase() !== "TX") return null;
  const key = city.trim().toLowerCase();
  return CITY_COUNTY[key] ?? null;
}

function normalizeAddr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\broad\b/g, "rd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\s+/g, " ")
    .trim();
}

function listingToSuggestion(l: FreeLeadListing): PropertySuggestion {
  const lotSf =
    l.acres != null && l.acres > 0 ? Math.round(l.acres * 43560) : null;
  // Year built may appear in notes from FBCAD pull (e.g. "YearBuilt: 1984")
  let yearBuilt: number | null = null;
  const yearMatch = (l.notes || "").match(/(?:year\s*built|built)[:\s]+(\d{4})/i);
  if (yearMatch) {
    const y = Number(yearMatch[1]);
    if (y >= 1800 && y <= 2100) yearBuilt = y;
  }
  return {
    id: l.id,
    label: [l.address, l.city, l.state, l.zip].filter(Boolean).join(", "),
    address: l.address,
    city: l.city,
    county: l.county,
    state: l.state || "TX",
    zip: l.zip,
    provider: l.provider,
    taxAssessment: l.price ?? null,
    buildingSf: l.buildingSf ?? null,
    lotSf,
    yearBuilt,
    apn: l.apn,
    source:
      l.provider === "fbcad"
        ? "fbcad-live"
        : l.provider === "hcad"
          ? "free-cad"
          : "free-cad",
    notes: l.buildingSfNote || l.notes,
  };
}

/** Local free CAD leads only — never demo/sample stubs. */
export function searchFreeLeads(query: string, limit = 8): PropertySuggestion[] {
  const q = normalizeAddr(query);
  if (q.length < 3) return [];
  const tokens = q.split(" ").filter((t) => t.length > 1);
  const scored: { score: number; s: PropertySuggestion }[] = [];

  // Real CAD cache only (no demo SAMPLE_LISTINGS)
  const inventory =
    getFreeCadListings().length > 0
      ? getFreeCadListings()
      : getFinderInventory().filter((l) => l.source !== "sample");

  for (const l of inventory) {
    if (l.source === "sample") continue;
    const hay = normalizeAddr(
      `${l.address} ${l.city} ${l.zip} ${l.county} ${l.apn || ""}`,
    );
    if (!hay.includes(tokens[0]!)) continue;
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += t.length;
    }
    if (normalizeAddr(l.address).startsWith(tokens.slice(0, 2).join(" "))) {
      score += 20;
    }
    if (score >= tokens.join("").length * 0.4) {
      scored.push({ score, s: listingToSuggestion(l) });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.s);
}

function buildSiteAddress(a: Record<string, unknown>): string {
  const parts = [
    a.site_str_num,
    a.site_str_pfx,
    a.site_str_name,
    a.site_str_sfx,
    a.site_str_sfx_dir,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  return parts.join(" ");
}

/** Live HCAD parcel match by house number + street tokens (Harris County). */
export async function searchHcadLive(
  query: string,
  limit = 6,
): Promise<PropertySuggestion[]> {
  const q = query.trim();
  if (q.length < 5) return [];
  const numMatch = q.match(/^(\d{1,6})\s+(.+)$/);
  if (!numMatch) return [];
  const houseNum = numMatch[1]!;
  const rest = numMatch[2]!
    .replace(/[,.].*$/, "")
    .trim()
    .toUpperCase()
    .replace(/\b(STREET|ST|AVENUE|AVE|DRIVE|DR|ROAD|RD|LANE|LN|BLVD|BOULEVARD)\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .slice(0, 2);
  if (!rest.length) return [];

  const streetCond = rest
    .map((t) => `UPPER(site_str_name) LIKE '%${t.replace(/'/g, "''")}%'`)
    .join(" AND ");
  const where = `site_str_num=${Number(houseNum)} AND ${streetCond}`;
  const outFields =
    "HCAD_NUM,site_str_num,site_str_pfx,site_str_name,site_str_sfx,site_str_sfx_dir,site_city,site_zip,total_market_val,total_appraised_val,land_sqft,tax_year";
  const endpoints = [
    "https://www.gis.hctx.net/arcgishcpid/rest/services/HCAD/Parcels/FeatureServer/0/query",
    "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query",
  ];

  for (const base of endpoints) {
    try {
      const url = new URL(base);
      url.searchParams.set("where", where);
      url.searchParams.set("outFields", outFields);
      url.searchParams.set("returnGeometry", "false");
      url.searchParams.set("f", "json");
      url.searchParams.set("resultRecordCount", String(limit));
      const res = await fetch(url.toString(), {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        features?: { attributes?: Record<string, unknown> }[];
        error?: { message?: string };
      };
      if (data.error || !data.features?.length) continue;
      return data.features.slice(0, limit).map((f, i) => {
        const a = f.attributes || {};
        const address = buildSiteAddress(a);
        const city = String(a.site_city || "Houston").trim();
        const zip = String(a.site_zip || "").trim();
        const market = Number(a.total_market_val || a.total_appraised_val) || null;
        const lotSf = Number(a.land_sqft) || null;
        return {
          id: `hcad-${a.HCAD_NUM || i}`,
          label: [address, city, "TX", zip].filter(Boolean).join(", "),
          address,
          city,
          county: "Harris",
          state: "TX",
          zip,
          provider: "hcad",
          taxAssessment: market,
          buildingSf: null,
          lotSf,
          yearBuilt: null,
          apn: String(a.HCAD_NUM || "").trim() || undefined,
          source: "hcad-live" as const,
          notes: "Harris CAD parcel · assessed value (not MLS). Living area not on layer.",
        };
      });
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}

/** US Census one-line geocoder — structured address only (no tax/sf). */
export async function censusGeocode(
  query: string,
): Promise<PropertySuggestion | null> {
  if (query.trim().length < 8) return null;
  try {
    const url = new URL(
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
    );
    url.searchParams.set("address", query.trim());
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("format", "json");
    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: {
        addressMatches?: {
          matchedAddress?: string;
          addressComponents?: {
            fromAddress?: string;
            streetName?: string;
            suffixType?: string;
            city?: string;
            state?: string;
            zip?: string;
          };
        }[];
      };
    };
    const match = data.result?.addressMatches?.[0];
    if (!match?.matchedAddress) return null;
    const c = match.addressComponents || {};
    const street = [
      c.fromAddress,
      c.streetName,
      c.suffixType,
    ]
      .filter(Boolean)
      .join(" ");
    const city = c.city || "";
    const state = c.state || "TX";
    const zip = c.zip || "";
    return {
      id: `census-${zip}-${street}`,
      label: match.matchedAddress,
      address: street || match.matchedAddress.split(",")[0] || query,
      city,
      county: guessCounty(city, state) || "",
      state,
      zip,
      source: "census",
      notes: "US Census geocode — address only. Add size and tax from records.",
    };
  } catch {
    return null;
  }
}

export async function combinedSuggest(
  query: string,
): Promise<PropertySuggestion[]> {
  const local = searchFreeLeads(query, 8);
  const out: PropertySuggestion[] = [];
  const ids = new Set<string>();

  const push = (s: PropertySuggestion) => {
    const k = s.label.toLowerCase();
    if (ids.has(k)) return;
    // Never surface demo samples as "real" lookups
    if (s.source === "sample") return;
    out.push(s);
    ids.add(k);
  };

  for (const s of local) push(s);

  // Always try live HCAD for number+street patterns (real assessor)
  const hcad = await searchHcadLive(query, 6);
  for (const s of hcad) push(s);

  // Census for nationwide address structure when nothing/local thin
  if (out.length < 3) {
    const geo = await censusGeocode(query);
    if (geo) push(geo);
  }

  return out.slice(0, 10);
}

/** Map a suggestion onto deal property fields (only fills known values). */
export function suggestionToPropertyPatch(
  s: PropertySuggestion,
): Partial<PropertyInfo> {
  const patch: Partial<PropertyInfo> = {
    address: s.address,
    city: s.city,
    state: s.state || "TX",
    zip: s.zip,
  };
  if (s.apn) patch.apn = s.apn;
  if (s.buildingSf != null && s.buildingSf > 0) patch.buildingSf = s.buildingSf;
  if (s.lotSf != null && s.lotSf > 0) patch.lotSf = s.lotSf;
  if (s.yearBuilt != null && s.yearBuilt > 1800) patch.yearBuilt = s.yearBuilt;
  if (s.taxAssessment != null && s.taxAssessment > 0) {
    patch.taxAssessment = s.taxAssessment;
  }
  return patch;
}

export function resolveMarketComps(input: {
  city?: string;
  state?: string;
  county?: string;
  buildingSf?: number | null;
  arv?: number | null;
}): MarketCompsSnapshot | null {
  const state = (input.state || "TX").toUpperCase();
  const county =
    input.county ||
    guessCounty(input.city || "", state) ||
    (state === "TX" ? "Harris" : null);
  if (!county) return null;
  const comp: AreaComp | null = findAreaComp(county, state);
  if (!comp) return null;
  const meta = getAreaCompsMeta();
  const typicalSf = meta.typicalHomeSf || 1900;
  const impliedMedianHome = Math.round(comp.medianHomePsf * typicalSf);
  const dealPsf =
    input.buildingSf &&
    input.buildingSf > 0 &&
    input.arv != null &&
    input.arv > 0
      ? input.arv / input.buildingSf
      : null;
  const vsMedianPct =
    dealPsf != null && comp.medianHomePsf > 0
      ? ((dealPsf - comp.medianHomePsf) / comp.medianHomePsf) * 100
      : null;

  return {
    county: comp.county,
    state: comp.state,
    metro: comp.metro,
    medianHomePsf: comp.medianHomePsf,
    impliedMedianHome,
    avgLandPerAcre: comp.avgLandPerAcre,
    zhvi: comp.zhvi,
    asOf: formatZhviAsOf(meta.asOf),
    disclaimer:
      meta.disclaimer ||
      "Area medians from free public indices — not MLS comps or an appraisal.",
    homeSource: comp.homeSource,
    fhfaYoyPct: meta.fhfa?.yoyPct ?? null,
    dealPsf,
    vsMedianPct,
  };
}
