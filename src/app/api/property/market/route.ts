import { NextResponse } from "next/server";
import { resolveMarketCompsAsync } from "@/lib/market-comps";

export const dynamic = "force-dynamic";

/**
 * GET /api/property/market?city=&state=&zip=&buildingSf=&arv=
 * Free ZHVI zip/county first; optional RentCast when RENTCAST_API_KEY set.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get("city") || "").trim();
  const state = (searchParams.get("state") || "").trim();
  const zip = (searchParams.get("zip") || "").trim();
  const address = (searchParams.get("address") || "").trim();
  const county = (searchParams.get("county") || "").trim();
  const buildingSfRaw = searchParams.get("buildingSf");
  const arvRaw = searchParams.get("arv");
  const buildingSf = buildingSfRaw ? Number(buildingSfRaw) : null;
  const arv = arvRaw ? Number(arvRaw) : null;

  if (!city && !zip && !address) {
    return NextResponse.json({ snapshot: null });
  }

  try {
    const snapshot = await resolveMarketCompsAsync({
      address,
      city,
      state,
      zip,
      county: county || undefined,
      buildingSf: Number.isFinite(buildingSf) ? buildingSf : null,
      arv: Number.isFinite(arv) ? arv : null,
    });
    return NextResponse.json({
      snapshot,
      rentcastConfigured: Boolean(process.env.RENTCAST_API_KEY?.trim()),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Market lookup failed";
    return NextResponse.json(
      { snapshot: null, error: message },
      { status: 200 },
    );
  }
}
