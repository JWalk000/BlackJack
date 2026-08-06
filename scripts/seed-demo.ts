/**
 * Seed Postgres with markets, build costs, and sample off-market leads.
 * Safe to re-run (upserts).
 *
 * Usage:
 *   1. docker compose up -d
 *   2. Set DATABASE_URL in .env.local
 *   3. npx tsx scripts/seed-demo.ts
 */
import { OFF_MARKET_LEADS } from "../src/data/offmarket-leads";
import {
  BUILD_COSTS,
  MARKETS,
  SUBMARKETS,
} from "../src/data/markets";
import { applySchema, createPool, hasDatabase } from "./lib/db";

async function main() {
  if (!hasDatabase()) {
    console.error(
      "No DATABASE_URL. Copy .env.example to .env.local and run: docker compose up -d",
    );
    process.exit(1);
  }

  const pool = createPool();
  const client = await pool.connect();

  try {
    console.log("Applying schema…");
    await applySchema(pool);

    console.log("Seeding markets…");
    for (const [id, m] of Object.entries(MARKETS)) {
      await client.query(
        `INSERT INTO markets (id, label, anchor, radius_note, as_of)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           label = EXCLUDED.label,
           anchor = EXCLUDED.anchor,
           radius_note = EXCLUDED.radius_note,
           as_of = EXCLUDED.as_of,
           updated_at = now()`,
        [id, m.label, m.anchor, m.radiusNote, m.asOf],
      );
    }

    console.log("Seeding submarkets…");
    for (const s of SUBMARKETS) {
      await client.query(
        `INSERT INTO submarkets (
           id, market_id, name, state, county, miles_from_anchor,
           sale_psf, typical_unit_sf, land_psf, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           sale_psf = EXCLUDED.sale_psf,
           typical_unit_sf = EXCLUDED.typical_unit_sf,
           land_psf = EXCLUDED.land_psf,
           notes = EXCLUDED.notes,
           updated_at = now()`,
        [
          s.id,
          s.marketId,
          s.name,
          s.state,
          s.county,
          s.milesFromAnchor,
          s.salePsf,
          s.typicalUnitSf,
          s.landPsf,
          s.notes ?? null,
        ],
      );
    }

    console.log("Seeding build costs…");
    for (const b of BUILD_COSTS) {
      const id = `${b.marketId}:${b.productType}`;
      await client.query(
        `INSERT INTO build_costs (
           id, market_id, product_type, label, hard_cost_psf, soft_pct, contingency_pct
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           hard_cost_psf = EXCLUDED.hard_cost_psf,
           soft_pct = EXCLUDED.soft_pct,
           contingency_pct = EXCLUDED.contingency_pct,
           updated_at = now()`,
        [
          id,
          b.marketId,
          b.productType,
          b.label,
          b.hardCostPsf,
          b.softPct,
          b.contingencyPct,
        ],
      );
    }

    console.log("Seeding sample parcels + off-market leads…");
    let upserted = 0;
    for (const lead of OFF_MARKET_LEADS) {
      const state = lead.marketId === "houston" ? "TX" : "VA";
      const parcelRes = await client.query<{ id: string }>(
        `INSERT INTO parcels (
           market_id, submarket_id, source, apn, address, city, county, state,
           acres, lot_sf, land_value, improvement_value, total_assessed,
           year_built, living_sf, land_use, owner_mailing, owner_state,
           tax_delinquent, listed_for_sale, miles_from_anchor, raw
         ) VALUES (
           $1,$2,'manual_sample',$3,$4,$5,$6,$7,
           $8,$9,$10,$11,$12,
           $13,$14,$15,$16,$17,
           $18,false,$19,$20::jsonb
         )
         ON CONFLICT (source, apn) DO UPDATE SET
           land_value = EXCLUDED.land_value,
           improvement_value = EXCLUDED.improvement_value,
           total_assessed = EXCLUDED.total_assessed,
           tax_delinquent = EXCLUDED.tax_delinquent,
           updated_at = now()
         RETURNING id`,
        [
          lead.marketId,
          lead.submarketId,
          lead.apn,
          lead.address,
          lead.city,
          lead.county,
          state,
          lead.acres,
          lead.lotSf,
          lead.landValue,
          lead.improvementValue,
          lead.askingOrAssessed,
          lead.yearBuilt,
          lead.livingSf,
          lead.kind,
          lead.ownerMailingHint,
          lead.ownerType === "out_of_state" ? "OUT" : state,
          lead.taxDelinquent,
          lead.milesFromAnchor,
          JSON.stringify(lead),
        ],
      );

      const parcelId = parcelRes.rows[0].id;
      const signals = [
        "Not listed (off-market)",
        lead.absenteeOwner ? "Absentee owner" : null,
        lead.ownerType === "estate" ? "Estate" : null,
        lead.taxDelinquent ? "Tax delinquent" : null,
      ].filter(Boolean);

      await client.query(
        `INSERT INTO deal_leads (
           parcel_id, market_id, submarket_id, kind, why_off_market, signals
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (parcel_id, kind) DO UPDATE SET
           why_off_market = EXCLUDED.why_off_market,
           signals = EXCLUDED.signals,
           updated_at = now()`,
        [
          parcelId,
          lead.marketId,
          lead.submarketId,
          lead.kind,
          lead.whyOffMarket,
          JSON.stringify(signals),
        ],
      );
      upserted += 1;
    }

    await client.query(
      `INSERT INTO ingest_runs (source, market_id, status, rows_upserted, message, finished_at)
       VALUES ('manual_sample', null, 'ok', $1, 'Seeded demo markets, costs, parcels, leads', now())`,
      [upserted],
    );

    console.log(`Done. ${upserted} sample parcels/leads ready.`);
    console.log("Next: keep Deal Finder using samples, or wire queries to Postgres.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
