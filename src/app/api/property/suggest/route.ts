import { NextResponse } from "next/server";
import { combinedSuggest } from "@/lib/property-lookup";

export const dynamic = "force-dynamic";

/**
 * GET /api/property/suggest?q=4122+Red+Bluff
 * Free sources: free-leads cache, live HCAD, Census geocode fallback.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }
  try {
    const suggestions = await combinedSuggest(q);
    return NextResponse.json({ suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lookup failed";
    return NextResponse.json(
      { suggestions: [], error: message },
      { status: 200 },
    );
  }
}
