/**
 * Monthly county ingest skeleton.
 *
 * This is the pattern you will re-run on a schedule — not live per user:
 *   1. Download/export bulk files from counties (or GIS FeatureServer)
 *   2. Normalize rows → ParcelRow[]
 *   3. Upsert into parcels
 *   4. Re-derive deal_leads (vacant / teardown / underimproved)
 *
 * Usage (after you plug real fetchers):
 *   npx tsx scripts/ingest/run-ingest.ts --market houston
 *   npx tsx scripts/ingest/run-ingest.ts --market virginia
 *
 * Sources to wire first (free or low-cost bulk):
 *   Houston ring:
 *     - Harris CAD (HCAD) public data extracts
 *     - Fort Bend CAD, Montgomery CAD
 *   VA corridor:
 *     - Fairfax, Prince William, Stafford, Hanover, Henrico,
 *       Richmond City, Chesterfield GIS / open data portals
 *
 * Derivation rules used below are the product rules — keep them even when
 * the source changes.
 */
import { applySchema, createPool, hasDatabase } from "../lib/db";

export type ParcelRow = {
  marketId: "houston" | "virginia";
  submarketId?: string | null;
  source: string;
  apn: string;
  address?: string | null;
  city?: string | null;
  county: string;
  state: string;
  acres?: number | null;
  lotSf?: number | null;
  landValue?: number | null;
  improvementValue?: number | null;
  totalAssessed?: number | null;
  yearBuilt?: number | null;
  livingSf?: number | null;
  landUse?: string | null;
  ownerName?: string | null;
  ownerMailing?: string | null;
  ownerCity?: string | null;
  ownerState?: string | null;
  lastSaleDate?: string | null;
  lastSalePrice?: number | null;
  taxDelinquent?: boolean;
  listedForSale?: boolean;
  milesFromAnchor?: number | null;
  raw?: unknown;
};

export type LeadKind = "vacant_land" | "teardown" | "underimproved";

/** Classify off-market style opportunities from assessor fields */
export function classifyLead(p: ParcelRow): LeadKind | null {
  const land = p.landValue ?? 0;
  const improv = p.improvementValue ?? 0;
  const use = (p.landUse ?? "").toLowerCase();
  const vacant =
    improv <= 0 ||
    /vacant|land|unimproved/.test(use) ||
    (p.livingSf != null && p.livingSf === 0);

  if (vacant && land > 0) return "vacant_land";

  if (land > 0 && improv > 0) {
    const ratio = improv / land;
    if (ratio < 0.2) return "teardown";
    if (ratio < 0.45 && (p.lotSf ?? 0) >= 10000) return "underimproved";
  }

  return null;
}

export function absenteeSignal(p: ParcelRow): boolean {
  if (!p.ownerState || !p.state) return false;
  return p.ownerState.toUpperCase() !== p.state.toUpperCase();
}

async function upsertParcel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  p: ParcelRow,
): Promise<string> {
  const res = await client.query(
    `INSERT INTO parcels (
       market_id, submarket_id, source, apn, address, city, county, state,
       acres, lot_sf, land_value, improvement_value, total_assessed,
       year_built, living_sf, land_use, owner_name, owner_mailing,
       owner_city, owner_state, last_sale_date, last_sale_price,
       tax_delinquent, listed_for_sale, miles_from_anchor, raw
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,
       $9,$10,$11,$12,$13,
       $14,$15,$16,$17,$18,
       $19,$20,$21,$22,
       $23,$24,$25,$26::jsonb
     )
     ON CONFLICT (source, apn) DO UPDATE SET
       land_value = EXCLUDED.land_value,
       improvement_value = EXCLUDED.improvement_value,
       total_assessed = EXCLUDED.total_assessed,
       owner_name = EXCLUDED.owner_name,
       owner_mailing = EXCLUDED.owner_mailing,
       tax_delinquent = EXCLUDED.tax_delinquent,
       updated_at = now()
     RETURNING id`,
    [
      p.marketId,
      p.submarketId ?? null,
      p.source,
      p.apn,
      p.address ?? null,
      p.city ?? null,
      p.county,
      p.state,
      p.acres ?? null,
      p.lotSf ?? null,
      p.landValue ?? null,
      p.improvementValue ?? null,
      p.totalAssessed ?? null,
      p.yearBuilt ?? null,
      p.livingSf ?? null,
      p.landUse ?? null,
      p.ownerName ?? null,
      p.ownerMailing ?? null,
      p.ownerCity ?? null,
      p.ownerState ?? null,
      p.lastSaleDate ?? null,
      p.lastSalePrice ?? null,
      p.taxDelinquent ?? false,
      p.listedForSale ?? false,
      p.milesFromAnchor ?? null,
      JSON.stringify(p.raw ?? p),
    ],
  );
  return res.rows[0].id as string;
}

/**
 * Houston: live free HCAD + FBCAD ArcGIS samples.
 */
async function loadHouston(): Promise<ParcelRow[]> {
  try {
    const { pullHcadCandidates } = await import("../data/sources/hcad");
    const { pullFbcadCandidates } = await import("../data/sources/fbcad");
    const { mapHoustonParcelsToLeads, writeFreeLeads } = await import(
      "../data/map-to-leads"
    );
    const parcels = [
      ...(await pullHcadCandidates({
        vacantLimit: 120,
        teardownLimit: 120,
        underLimit: 60,
      })),
      ...(await pullFbcadCandidates({
        vacantLimit: 80,
        teardownLimit: 80,
        underLimit: 40,
      })),
    ];
    writeFreeLeads(mapHoustonParcelsToLeads(parcels));
    return parcels.map((p) => ({
      marketId: "houston" as const,
      submarketId: null,
      source: p.source,
      apn: p.apn,
      address: p.address,
      city: p.city,
      county: p.county,
      state: "TX",
      acres: p.acres,
      lotSf: p.lotSf,
      landValue: p.landValue,
      improvementValue: p.improvementValue,
      totalAssessed: p.totalAssessed,
      yearBuilt: p.yearBuilt,
      livingSf: p.livingSf,
      landUse: p.landUse,
      ownerName: p.ownerName,
      ownerMailing: p.mailAddr,
      ownerCity: p.mailCity,
      ownerState: p.mailState,
      taxDelinquent: false,
      listedForSale: false,
      milesFromAnchor: null,
      raw: p,
    }));
  } catch (err) {
    console.warn(
      "[houston] live CAD pull failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function loadVirginiaStub(): Promise<ParcelRow[]> {
  console.log(
    "[virginia] skipped — free data pipeline is Houston + surrounding only for now",
  );
  return [];
}

async function main() {
  const marketArg = process.argv.includes("--market")
    ? process.argv[process.argv.indexOf("--market") + 1]
    : "all";

  if (!hasDatabase()) {
    console.error("Set DATABASE_URL first (see .env.example).");
    process.exit(1);
  }

  const pool = createPool();
  await applySchema(pool);
  const client = await pool.connect();

  try {
    const rows: ParcelRow[] = [];
    if (marketArg === "all" || marketArg === "houston") {
      rows.push(...(await loadHouston()));
    }
    if (marketArg === "all" || marketArg === "virginia") {
      rows.push(...(await loadVirginiaStub()));
    }

    let upserted = 0;
    let leads = 0;

    for (const row of rows) {
      const parcelId = await upsertParcel(client, row);
      upserted += 1;

      const kind = classifyLead(row);
      if (!kind) continue;

      const signals = [
        "Not listed (off-market)",
        kind === "vacant_land" ? "Vacant / land-only" : null,
        kind === "teardown" ? "Teardown / rebuild" : null,
        kind === "underimproved" ? "Underimproved" : null,
        absenteeSignal(row) ? "Absentee owner" : null,
        row.taxDelinquent ? "Tax delinquent" : null,
      ].filter(Boolean);

      await client.query(
        `INSERT INTO deal_leads (
           parcel_id, market_id, submarket_id, kind, why_off_market, signals, active
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,true)
         ON CONFLICT (parcel_id, kind) DO UPDATE SET
           signals = EXCLUDED.signals,
           active = true,
           updated_at = now()`,
        [
          parcelId,
          row.marketId,
          row.submarketId ?? null,
          kind,
          `Auto-classified as ${kind} from ${row.source}`,
          JSON.stringify(signals),
        ],
      );
      leads += 1;
    }

    await client.query(
      `INSERT INTO ingest_runs (source, market_id, status, rows_upserted, message, finished_at)
       VALUES ($1,$2,'ok',$3,$4,now())`,
      [
        "run-ingest",
        marketArg === "all" ? null : marketArg,
        upserted,
        `Parcels ${upserted}, leads ${leads}. Prefer free cache via npm run data:pull without DATABASE_URL.`,
      ],
    );

    console.log(
      `Ingest finished for market=${marketArg}. parcels=${upserted} leads=${leads}`,
    );
    if (upserted === 0) {
      console.log(
        "No parcel rows upserted — run `npm run data:pull` for free HCAD leads without Postgres.",
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
