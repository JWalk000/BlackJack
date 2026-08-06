import { NextResponse } from "next/server";
import type { MarketId } from "@/data/markets";
import { loadAcsSignals, loadFhfaSignals } from "@/lib/free-data";

export const dynamic = "force-dynamic";

/**
 * Free market signals (FHFA HPI + optional ACS) from data/cache.
 * Populate with: npm run data:pull
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get("market") as MarketId | null;
  const valid =
    market === "houston" || market === "virginia" ? market : undefined;

  const fhfa = loadFhfaSignals(valid);
  const acs = loadAcsSignals(valid);

  return NextResponse.json({
    available: Boolean(fhfa || acs),
    fhfa,
    acs,
    hint:
      !fhfa && !acs
        ? "Run npm run data:pull (free FHFA + Harris CAD; optional CENSUS_API_KEY)."
        : undefined,
  });
}
