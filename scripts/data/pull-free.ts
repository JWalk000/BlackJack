/**
 * Pull free/public Houston metro data — no paid APIs.
 *
 * Market focus: Houston + surrounding counties (Harris, Fort Bend).
 *
 *   npm run data:pull
 *
 * Optional: CENSUS_API_KEY for free ACS county housing stats.
 *
 * Outputs under data/cache/ (app reads when DATABASE_URL is unset).
 */
import "dotenv/config";
import { writeJson } from "./lib/io";
import { mapHoustonParcelsToLeads, writeFreeLeads } from "./map-to-leads";
import { pullCensusAcs } from "./sources/census-acs";
import { pullFhfaHpi } from "./sources/fhfa";
import { pullFbcadCandidates } from "./sources/fbcad";
import { pullHcadCandidates } from "./sources/hcad";

async function main() {
  const args = process.argv.slice(2);
  const skipParcels = args.includes("--skip-parcels");
  const skipHpi = args.includes("--skip-hpi");

  console.log("Estate free data pull — Houston metro only\n");

  if (!skipHpi) {
    const metros = await pullFhfaHpi();
    // Keep full file for later markets, but log Houston emphasis
    const hou = metros.filter((m) => m.marketId === "houston");
    console.log(
      `[fhfa] Houston series: ${hou.map((m) => `${m.placeName} YoY ${m.yoyPct}%`).join("; ") || "none"}`,
    );
  }

  // ACS only for Houston-side counties when key present
  await pullCensusAcs(process.env.CENSUS_API_KEY);

  if (!skipParcels) {
    const all = [];
    try {
      all.push(...(await pullHcadCandidates()));
    } catch (err) {
      console.error(
        "[hcad] failed:",
        err instanceof Error ? err.message : err,
      );
    }
    try {
      all.push(...(await pullFbcadCandidates()));
    } catch (err) {
      console.error(
        "[fbcad] failed:",
        err instanceof Error ? err.message : err,
      );
    }

    if (all.length) {
      writeFreeLeads(mapHoustonParcelsToLeads(all));
    } else {
      console.warn("[parcels] no Houston parcels pulled");
    }
  }

  writeJson("pull-meta.json", {
    market: "houston",
    real: true,
    finishedAt: new Date().toISOString(),
    skipParcels,
    skipHpi,
    hasCensusKey: Boolean(process.env.CENSUS_API_KEY),
  });

  console.log("\nDone. Houston free data is real assessor GIS (HCAD + FBCAD).");
  console.log("  npm run dev → /deals (Houston) uses data/cache/leads-free.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
