import { NextResponse } from "next/server";
import { loadOffMarketLeads } from "@/lib/parcel-repo";
import type { MarketId } from "@/data/markets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get("market") as MarketId | null;
  const valid =
    market === "houston" || market === "virginia" ? market : undefined;

  const result = await loadOffMarketLeads(valid);
  return NextResponse.json({
    source: result.source,
    count: result.leads.length,
    leads: result.leads,
    pulledAt: result.pulledAt ?? null,
  });
}
