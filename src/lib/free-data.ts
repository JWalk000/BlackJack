import { existsSync, readFileSync } from "fs";
import path from "path";
import type { MarketId } from "@/data/markets";
import type { OffMarketLead } from "@/data/offmarket-leads";

export type FreeLeadsFile = {
  source: string;
  pulledAt: string;
  count: number;
  notes?: string;
  leads: (OffMarketLead & {
    lat?: number | null;
    lng?: number | null;
    dataSource?: string;
  })[];
};

export type MetroHpiFile = {
  source: string;
  pulledAt: string;
  metros: {
    marketId: MarketId;
    placeId: string;
    placeName: string;
    latest: { year: number; period: number; index: number } | null;
    yoyPct: number | null;
    fiveYearPct: number | null;
  }[];
};

export type AcsFile = {
  source: string;
  pulledAt: string;
  counties: {
    marketId: MarketId;
    name: string;
    medianHomeValue: number | null;
    medianGrossRent: number | null;
    housingUnits: number | null;
  }[];
};

function cachePath(name: string) {
  return path.join(process.cwd(), "data", "cache", name);
}

function readCacheJson<T>(name: string): T | null {
  try {
    const file = cachePath(name);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Leads from `npm run data:pull` (HCAD open GIS). */
export function loadFreeLeads(marketId?: MarketId): OffMarketLead[] {
  const file = readCacheJson<FreeLeadsFile>("leads-free.json");
  if (!file?.leads?.length) return [];
  const leads = file.leads.map((l) => ({
    ...l,
    listedForSale: false as const,
  }));
  if (!marketId) return leads;
  return leads.filter((l) => l.marketId === marketId);
}

export function freeLeadsPulledAt(): string | null {
  return readCacheJson<FreeLeadsFile>("leads-free.json")?.pulledAt ?? null;
}

export function loadFhfaSignals(marketId?: MarketId) {
  const file = readCacheJson<MetroHpiFile>("fhfa-hpi.json");
  if (!file?.metros?.length) return null;
  return {
    pulledAt: file.pulledAt,
    source: file.source,
    metros: marketId
      ? file.metros.filter((m) => m.marketId === marketId)
      : file.metros,
  };
}

export function loadAcsSignals(marketId?: MarketId) {
  const file = readCacheJson<AcsFile>("census-acs.json");
  if (!file?.counties?.length) return null;
  return {
    pulledAt: file.pulledAt,
    source: file.source,
    counties: marketId
      ? file.counties.filter((c) => c.marketId === marketId)
      : file.counties,
  };
}
