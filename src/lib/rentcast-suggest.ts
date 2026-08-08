/**
 * Map RentCast property records to PropertySuggestion (server path).
 */

import {
  formatRentCastAddress,
  hasRentCastKey,
  latestTaxAssessment,
  rentcastPropertyByAddress,
} from "@/lib/rentcast";
import type { PropertySuggestion } from "@/lib/property-lookup";

export { hasRentCastKey };

export async function rentcastPropertyToSuggestion(
  query: string,
): Promise<PropertySuggestion | null> {
  const q = query.trim();
  if (q.length < 10) return null;
  if (!/,/.test(q) && !/\d{5}/.test(q) && !/\b[A-Z]{2}\b/i.test(q)) {
    if (!/\s+[A-Za-z]+\s+[A-Z]{2}\b/i.test(q)) return null;
  }

  const prop = await rentcastPropertyByAddress(q);
  if (!prop) return null;

  const address =
    prop.addressLine1 || prop.formattedAddress?.split(",")[0]?.trim() || q;
  const city = prop.city || "";
  const state = prop.state || "";
  const zip = prop.zipCode || "";
  const tax = latestTaxAssessment(prop);
  const lotSf =
    prop.lotSize != null && prop.lotSize > 0 ? Math.round(prop.lotSize) : null;

  return {
    id: `rentcast-${prop.id || zip}-${address}`,
    label:
      prop.formattedAddress ||
      formatRentCastAddress({ address, city, state, zip }) ||
      address,
    address,
    city,
    county: prop.county || "",
    state,
    zip,
    provider: "rentcast",
    taxAssessment: tax ?? prop.lastSalePrice ?? null,
    buildingSf: prop.squareFootage ?? null,
    lotSf,
    yearBuilt: prop.yearBuilt ?? null,
    source: "rentcast",
    notes:
      "RentCast public-record style property data (not MLS). Cached 30 days server-side.",
  };
}
