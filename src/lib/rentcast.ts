/**
 * Optional RentCast API (cheap ATTOM alternative).
 * Requires RENTCAST_API_KEY — property records + zip market stats.
 * Free tier: 50 calls/mo. Cache aggressively.
 */

export type RentCastProperty = {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
  taxAssessments?: Record<
    string,
    { year?: number; value?: number; land?: number; improvements?: number }
  >;
};

export type RentCastMarketStats = {
  zipCode?: string;
  saleData?: {
    lastUpdatedDate?: string;
    medianPrice?: number | null;
    averagePrice?: number | null;
    medianPricePerSquareFoot?: number | null;
    averagePricePerSquareFoot?: number | null;
    medianSquareFootage?: number | null;
    averageSquareFootage?: number | null;
    totalListings?: number | null;
  };
};

const BASE = "https://api.rentcast.io/v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type CacheEntry<T> = { at: number; value: T };
const propCache = new Map<string, CacheEntry<RentCastProperty | null>>();
const marketCache = new Map<string, CacheEntry<RentCastMarketStats | null>>();

export function hasRentCastKey(): boolean {
  return Boolean(process.env.RENTCAST_API_KEY?.trim());
}

function apiKey(): string | null {
  const k = process.env.RENTCAST_API_KEY?.trim();
  return k || null;
}

function cacheGet<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
): T | undefined {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
) {
  map.set(key, { at: Date.now(), value });
}

async function rentcastGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Api-Key": key,
      },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[rentcast] ${path} HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn("[rentcast] request failed", e);
    return null;
  }
}

/** Full address string: Street, City, ST, Zip */
export function formatRentCastAddress(parts: {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}): string | null {
  const street = parts.address?.trim();
  if (!street) return null;
  const city = parts.city?.trim() || "";
  const state = (parts.state || "").trim().toUpperCase();
  const zip = (parts.zip || "").replace(/\D/g, "").slice(0, 5);
  const tail = [city, state, zip].filter(Boolean).join(", ");
  return tail ? `${street}, ${tail}` : street;
}

/**
 * Property record for one address (1 API report when cache miss).
 * Response is array for search; single-address returns 0–1 items.
 */
export async function rentcastPropertyByAddress(
  addressLine: string,
): Promise<RentCastProperty | null> {
  const key = addressLine.trim().toLowerCase();
  if (!key) return null;
  const cached = cacheGet(propCache, key);
  if (cached !== undefined) return cached;

  const data = await rentcastGet<RentCastProperty[] | RentCastProperty>(
    "/properties",
    { address: addressLine.trim() },
  );
  let prop: RentCastProperty | null = null;
  if (Array.isArray(data)) {
    prop = data[0] ?? null;
  } else if (data && typeof data === "object") {
    prop = data as RentCastProperty;
  }
  cacheSet(propCache, key, prop);
  return prop;
}

/** Zip market listing stats (1 report when cache miss). */
export async function rentcastMarketByZip(
  zip: string,
): Promise<RentCastMarketStats | null> {
  const z = zip.replace(/\D/g, "").slice(0, 5);
  if (z.length !== 5) return null;
  const cached = cacheGet(marketCache, z);
  if (cached !== undefined) return cached;

  const data = await rentcastGet<RentCastMarketStats>("/markets", {
    zipCode: z,
    dataType: "Sale",
    historyRange: "1",
  });
  cacheSet(marketCache, z, data);
  return data;
}

export function latestTaxAssessment(p: RentCastProperty): number | null {
  const taxes = p.taxAssessments;
  if (!taxes || typeof taxes !== "object") return null;
  const years = Object.keys(taxes)
    .map((y) => Number(y))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  for (const y of years) {
    const row = taxes[String(y)];
    const v = row?.value;
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}
