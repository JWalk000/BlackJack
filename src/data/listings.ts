/**
 * Lead inventory for Deal Finder.
 *
 * Prefer free CAD cache (`generated/free-leads.json` from `npm run data:pull`).
 * Fall back to static sample listings only when cache is empty.
 * User paste-in is layered in the UI (source: 'user').
 *
 * Provider swap later: free-cad | attom (paid) via source channel field.
 */

import type { SampleListing } from "@/data/sample-listings";
import { SAMPLE_LISTINGS } from "@/data/sample-listings";
import freeLeadsFile from "@/data/generated/free-leads.json";

/** Swapable inventory channel. ATTOM not integrated yet. */
export type ListingSource = "free-cad" | "user" | "sample" | "attom";

export type FreeLeadListing = SampleListing & {
  source: ListingSource;
  provider?: string;
  apn?: string;
  priceLabel?: string;
  priceMethod?: string;
  sourceAsOf?: string;
  buildingSfSource?: string;
  buildingSfNote?: string;
};

export type FreeLeadsMeta = {
  provider: string;
  sourceChannel: string;
  disclaimer: string;
  sources: {
    id: string;
    provider?: string;
    name: string;
    asOf?: string | null;
    pulledAt?: string | null;
    url?: string;
  }[];
  pulledAt: string | null;
  asOf: string | null;
  count: number;
  byProvider: Record<string, number>;
  byType: { home: number; land: number };
  errors: string[];
};

type FreeLeadsFile = FreeLeadsMeta & {
  listings: Array<
    SampleListing & {
      source?: ListingSource;
      provider?: string;
      apn?: string;
      priceLabel?: string;
      priceMethod?: string;
      sourceAsOf?: string;
      buildingSfSource?: string;
      buildingSfNote?: string;
    }
  >;
};

const file = freeLeadsFile as FreeLeadsFile;

function normalizeFreeListing(
  l: FreeLeadsFile["listings"][number],
): FreeLeadListing {
  return {
    ...l,
    source: (l.source as ListingSource) || "free-cad",
    provider: l.provider,
    apn: l.apn,
    priceLabel: l.priceLabel,
    priceMethod: l.priceMethod,
    sourceAsOf: l.sourceAsOf,
    buildingSfSource: l.buildingSfSource,
    buildingSfNote: l.buildingSfNote,
  };
}

/** True when pull wrote one or more free-cad leads. */
export function hasFreeCadInventory(): boolean {
  return Array.isArray(file.listings) && file.listings.length > 0;
}

/** Free CAD listings only (may be empty). */
export function getFreeCadListings(): FreeLeadListing[] {
  if (!hasFreeCadInventory()) return [];
  return file.listings.map(normalizeFreeListing);
}

/**
 * Primary inventory: free-cad when cache has data;
 * otherwise static samples (demo empty-fallback only).
 */
export function getFinderInventory(): FreeLeadListing[] {
  if (hasFreeCadInventory()) {
    return getFreeCadListings();
  }
  return SAMPLE_LISTINGS.map((l) => ({
    ...l,
    source: "sample" as const,
    provider: "demo",
    notes: l.notes ?? "Demo sample — run npm run data:pull for free CAD data",
  }));
}

export function getFreeLeadsMeta(): FreeLeadsMeta {
  return {
    provider: file.provider || "free-cad",
    sourceChannel: file.sourceChannel || "free-cad",
    disclaimer:
      file.disclaimer ||
      "Public CAD / research data when available. Not MLS list prices. Not ATTOM.",
    sources: file.sources || [],
    pulledAt: file.pulledAt ?? null,
    asOf: file.asOf ?? null,
    count: file.count ?? file.listings?.length ?? 0,
    byProvider: file.byProvider || {},
    byType: file.byType || { home: 0, land: 0 },
    errors: file.errors || [],
  };
}

export function inventoryMode(): "free-cad" | "sample" {
  return hasFreeCadInventory() ? "free-cad" : "sample";
}
