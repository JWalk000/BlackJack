/**
 * Map free Houston-metro CAD parcels → OffMarketLead-shaped JSON for the app.
 */
import { haversineMiles } from "./lib/geo";
import { writeJson } from "./lib/io";
import type { HoustonParcel } from "./lib/types";

type OpportunityKind = "vacant_land" | "teardown" | "underimproved";

const SUBMARKETS: {
  id: string;
  name: string;
  lat: number;
  lng: number;
  milesFromAnchor: number;
}[] = [
  { id: "hou-inner", name: "Inner Loop", lat: 29.752, lng: -95.359, milesFromAnchor: 3 },
  { id: "hou-heights", name: "Heights", lat: 29.798, lng: -95.398, milesFromAnchor: 5 },
  { id: "hou-energy", name: "Energy Corridor", lat: 29.775, lng: -95.6, milesFromAnchor: 14 },
  { id: "hou-katy", name: "Katy", lat: 29.786, lng: -95.825, milesFromAnchor: 28 },
  { id: "hou-sugar", name: "Sugar Land", lat: 29.62, lng: -95.635, milesFromAnchor: 20 },
  { id: "hou-pearland", name: "Pearland", lat: 29.564, lng: -95.286, milesFromAnchor: 18 },
  { id: "hou-woodlands", name: "Woodlands", lat: 30.166, lng: -95.461, milesFromAnchor: 28 },
  { id: "hou-conroe", name: "Conroe", lat: 30.312, lng: -95.456, milesFromAnchor: 40 },
  { id: "hou-league", name: "League City", lat: 29.508, lng: -95.095, milesFromAnchor: 25 },
  { id: "hou-baytown", name: "Baytown", lat: 29.736, lng: -94.977, milesFromAnchor: 25 },
  { id: "hou-cypress", name: "Cypress", lat: 29.969, lng: -95.697, milesFromAnchor: 26 },
  { id: "hou-rosenberg", name: "Rosenberg", lat: 29.557, lng: -95.809, milesFromAnchor: 32 },
];

export type FreeLead = {
  id: string;
  marketId: "houston";
  submarketId: string;
  address: string;
  city: string;
  county: string;
  apn: string;
  kind: OpportunityKind;
  acres: number;
  lotSf: number;
  askingOrAssessed: number;
  landValue: number;
  improvementValue: number;
  yearBuilt: number | null;
  livingSf: number | null;
  yearsOwned: number;
  absenteeOwner: boolean;
  ownerType: "individual" | "llc" | "trust" | "estate" | "out_of_state";
  taxDelinquent: boolean;
  listedForSale: false;
  milesFromAnchor: number;
  ownerMailingHint: string;
  whyOffMarket: string;
  lat?: number | null;
  lng?: number | null;
  dataSource: "hcad" | "fbcad";
};

function nearestSubmarket(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return SUBMARKETS[0];
  let best = SUBMARKETS[0];
  let bestD = Infinity;
  for (const s of SUBMARKETS) {
    const d = haversineMiles({ lat, lng }, { lat: s.lat, lng: s.lng });
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function ownerTypeOf(
  name: string | null,
  mailState: string | null,
): FreeLead["ownerType"] {
  const n = (name ?? "").toUpperCase();
  if (/\bLLC\b|\bL\.?L\.?C\.?\b|\bINC\b|\bLP\b|\bCORP\b/.test(n)) return "llc";
  if (/\bTRUST\b|\bTR\b/.test(n)) return "trust";
  if (/\bESTATE\b|\bEST OF\b/.test(n)) return "estate";
  if (mailState && mailState.toUpperCase() !== "TX") return "out_of_state";
  return "individual";
}

function why(
  kind: OpportunityKind,
  county: string,
  source: string,
  absentee: boolean,
): string {
  const cad = source === "fbcad" ? "FBCAD" : "HCAD";
  const base =
    kind === "vacant_land"
      ? `${cad} (${county}) shows vacant / land-heavy assessment — not MLS.`
      : kind === "teardown"
        ? `${cad} (${county}): land value dominates improvement (rebuild candidate).`
        : `${cad} (${county}): improvement low vs land + large lot (underimproved).`;
  return absentee
    ? `${base} Owner mailing outside TX (absentee signal).`
    : base;
}

export function mapHoustonParcelsToLeads(
  parcels: HoustonParcel[],
): FreeLead[] {
  const leads: FreeLead[] = [];
  for (const p of parcels) {
    if (!p.kindHint) continue;
    const sub = nearestSubmarket(p.lat, p.lng);
    const absentee =
      Boolean(p.mailState) && p.mailState!.toUpperCase() !== "TX";
    const oType = ownerTypeOf(p.ownerName, p.mailState);

    leads.push({
      id: `${p.source}-${p.apn}`,
      marketId: "houston",
      submarketId: sub.id,
      address: p.address,
      city: p.city,
      county: p.county,
      apn: p.apn,
      kind: p.kindHint,
      acres: p.acres ?? (p.lotSf ? p.lotSf / 43560 : 0),
      lotSf: p.lotSf ?? (p.acres ? Math.round(p.acres * 43560) : 0),
      askingOrAssessed: p.totalAssessed || p.landValue + p.improvementValue,
      landValue: p.landValue,
      improvementValue: p.improvementValue,
      yearBuilt: p.yearBuilt,
      livingSf: p.livingSf,
      yearsOwned: 0,
      absenteeOwner: absentee || oType === "out_of_state",
      ownerType: oType,
      taxDelinquent: false,
      listedForSale: false,
      milesFromAnchor: sub.milesFromAnchor,
      ownerMailingHint: p.mailAddr
        ? `${p.mailAddr}${p.mailCity ? `, ${p.mailCity}` : ""}${p.mailState ? ` ${p.mailState}` : ""}`
        : p.ownerName ?? `See ${p.source.toUpperCase()} owner`,
      whyOffMarket: why(
        p.kindHint,
        p.county,
        p.source,
        absentee || oType === "out_of_state",
      ),
      lat: p.lat,
      lng: p.lng,
      dataSource: p.source,
    });
  }

  leads.sort((a, b) => {
    const ac = a.lat != null ? 1 : 0;
    const bc = b.lat != null ? 1 : 0;
    return bc - ac || b.landValue - a.landValue;
  });

  return leads.slice(0, 350);
}

/** @deprecated use mapHoustonParcelsToLeads */
export function mapHcadToLeads(parcels: HoustonParcel[]): FreeLead[] {
  return mapHoustonParcelsToLeads(parcels);
}

export function writeFreeLeads(leads: FreeLead[]) {
  const bySource = leads.reduce(
    (acc, l) => {
      acc[l.dataSource] = (acc[l.dataSource] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const payload = {
    source: "free_open_data",
    market: "houston",
    real: true,
    pulledAt: new Date().toISOString(),
    notes:
      "Real Houston-area CAD data (Harris HCAD + Fort Bend FBCAD). Assessed values, not listing prices. Sample of free county GIS, not full county dump.",
    count: leads.length,
    bySource,
    leads,
  };
  writeJson("leads-free.json", payload);
  console.log(
    `[leads] ${leads.length} Houston-area free leads (${JSON.stringify(bySource)}) → data/cache/leads-free.json`,
  );
}
