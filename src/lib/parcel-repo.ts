import { queryDb, isDbConfigured } from "@/lib/db";
import type { MarketId } from "@/data/markets";
import type { OffMarketLead, OpportunityKind } from "@/data/offmarket-leads";
import { OFF_MARKET_LEADS } from "@/data/offmarket-leads";
import { freeLeadsPulledAt, loadFreeLeads } from "@/lib/free-data";

export type LeadSource = "database" | "open_data" | "sample";

export type StoredLead = OffMarketLead & { sourceLabel: LeadSource };

/**
 * Load off-market leads:
 * 1. Postgres when DATABASE_URL + rows exist
 * 2. Free open-data cache from `npm run data:pull` (HCAD)
 * 3. Built-in sample leads
 */
export async function loadOffMarketLeads(
  marketId?: MarketId,
): Promise<{ source: LeadSource; leads: OffMarketLead[]; pulledAt?: string }> {
  if (isDbConfigured()) {
    try {
      const rows = await queryDb<{
        apn: string;
        market_id: MarketId;
        submarket_id: string | null;
        address: string | null;
        city: string | null;
        county: string;
        kind: OpportunityKind;
        acres: string | null;
        lot_sf: string | null;
        total_assessed: string | null;
        land_value: string | null;
        improvement_value: string | null;
        year_built: number | null;
        living_sf: string | null;
        miles_from_anchor: string | null;
        tax_delinquent: boolean;
        owner_mailing: string | null;
        owner_state: string | null;
        why_off_market: string | null;
        lat: number | null;
        lng: number | null;
        raw: {
          ownerType?: OffMarketLead["ownerType"];
          yearsOwned?: number;
          whyOffMarket?: string;
          ownerMailingHint?: string;
          absenteeOwner?: boolean;
        } | null;
      }>(
        `SELECT
           p.apn, p.market_id, p.submarket_id, p.address, p.city, p.county,
           d.kind, p.acres, p.lot_sf, p.total_assessed, p.land_value, p.improvement_value,
           p.year_built, p.living_sf, p.miles_from_anchor, p.tax_delinquent,
           p.owner_mailing, p.owner_state, d.why_off_market, p.lat, p.lng, p.raw
         FROM deal_leads d
         JOIN parcels p ON p.id = d.parcel_id
         WHERE d.active = true
           AND ($1::text IS NULL OR p.market_id = $1)
         ORDER BY p.updated_at DESC
         LIMIT 500`,
        [marketId ?? null],
      );

      if (rows && rows.length > 0) {
        const leads: OffMarketLead[] = rows.map((r) => {
          const raw = r.raw ?? {};
          return {
            id: `db-${r.apn}`,
            marketId: r.market_id,
            submarketId: r.submarket_id ?? "",
            address: r.address ?? r.apn,
            city: r.city ?? "",
            county: r.county,
            apn: r.apn,
            kind: r.kind,
            acres: Number(r.acres ?? 0),
            lotSf: Number(r.lot_sf ?? 0),
            askingOrAssessed: Number(r.total_assessed ?? r.land_value ?? 0),
            landValue: Number(r.land_value ?? 0),
            improvementValue: Number(r.improvement_value ?? 0),
            yearBuilt: r.year_built,
            livingSf: r.living_sf != null ? Number(r.living_sf) : null,
            yearsOwned: raw.yearsOwned ?? 10,
            absenteeOwner:
              raw.absenteeOwner ??
              Boolean(
                r.owner_state &&
                  r.owner_state !== "TX" &&
                  r.owner_state !== "VA",
              ),
            ownerType: raw.ownerType ?? "individual",
            taxDelinquent: r.tax_delinquent,
            listedForSale: false,
            milesFromAnchor: Number(r.miles_from_anchor ?? 0),
            ownerMailingHint:
              raw.ownerMailingHint ?? r.owner_mailing ?? "See assessor mailing",
            whyOffMarket:
              r.why_off_market ??
              raw.whyOffMarket ??
              "Derived from assessor fields; not an MLS listing.",
            lat: r.lat,
            lng: r.lng,
          };
        });
        return { source: "database", leads };
      }
    } catch {
      // fall through to free cache / sample
    }
  }

  const free = loadFreeLeads(marketId);
  if (free.length > 0) {
    return {
      source: "open_data",
      leads: free,
      pulledAt: freeLeadsPulledAt() ?? undefined,
    };
  }

  return {
    source: "sample",
    leads: marketId
      ? OFF_MARKET_LEADS.filter((l) => l.marketId === marketId)
      : OFF_MARKET_LEADS,
  };
}
