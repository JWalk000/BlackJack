import type { MarketId } from "./markets";

/** Default map center / zoom by market */
export const MARKET_MAP_VIEW: Record<
  MarketId,
  { center: [number, number]; zoom: number }
> = {
  houston: { center: [29.76, -95.37], zoom: 9 },
  virginia: { center: [38.3, -77.45], zoom: 8 },
};

/** Approximate city centroids for sample leads (replace with geocoded parcels later) */
const CITY_COORDS: Record<string, [number, number]> = {
  Katy: [29.7858, -95.8245],
  Houston: [29.7604, -95.3698],
  Cypress: [29.9691, -95.6972],
  Conroe: [30.3119, -95.4561],
  Pearland: [29.5636, -95.2860],
  "Sugar Land": [29.6197, -95.6349],
  Baytown: [29.7355, -94.9774],
  "The Woodlands": [30.1658, -95.4613],
  Rosenberg: [29.5572, -95.8086],
  "League City": [29.5075, -95.0949],
  Woodbridge: [38.6582, -77.2497],
  Stafford: [38.4220, -77.4083],
  Fredericksburg: [38.3032, -77.4605],
  Henrico: [37.5059, -77.3347],
  Midlothian: [37.5057, -77.6492],
  Manassas: [38.7509, -77.4753],
  Ashland: [37.7590, -77.4800],
  Richmond: [37.5407, -77.4360],
  Ashburn: [39.0438, -77.4874],
  "Alexandria (FFX)": [38.8048, -77.1153],
};

/** Submarket pin locations for farm map */
export const SUBMARKET_COORDS: Record<string, [number, number]> = {
  "hou-inner": [29.752, -95.359],
  "hou-heights": [29.798, -95.398],
  "hou-energy": [29.775, -95.6],
  "hou-katy": [29.786, -95.825],
  "hou-sugar": [29.62, -95.635],
  "hou-pearland": [29.564, -95.286],
  "hou-woodlands": [30.166, -95.461],
  "hou-conroe": [30.312, -95.456],
  "hou-league": [29.508, -95.095],
  "hou-galveston": [29.301, -94.798],
  "hou-baytown": [29.736, -94.977],
  "hou-cypress": [29.969, -95.697],
  "hou-rosenberg": [29.557, -95.809],
  "hou-brenham": [30.167, -96.398],
  "hou-huntsville": [30.723, -95.551],
  "va-arlington": [38.881, -77.104],
  "va-alex": [38.805, -77.047],
  "va-fairfax": [38.846, -77.306],
  "va-loudoun": [39.044, -77.487],
  "va-pwc": [38.658, -77.25],
  "va-stafford": [38.422, -77.408],
  "va-fred": [38.303, -77.461],
  "va-ashland": [37.759, -77.48],
  "va-henrico": [37.551, -77.49],
  "va-richmond": [37.541, -77.436],
  "va-chester": [37.377, -77.505],
  "va-manassas": [38.751, -77.475],
};

/** Stable jitter so pins with same city don't stack perfectly */
function jitter(seed: string, amount = 0.018): [number, number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = ((h % 1000) / 1000 - 0.5) * 2 * amount;
  const b = (((h >> 10) % 1000) / 1000 - 0.5) * 2 * amount;
  return [a, b];
}

export function coordsForLead(input: {
  id: string;
  city: string;
  submarketId: string;
  lat?: number | null;
  lng?: number | null;
}): [number, number] | null {
  if (
    input.lat != null &&
    input.lng != null &&
    !Number.isNaN(input.lat) &&
    !Number.isNaN(input.lng)
  ) {
    return [input.lat, input.lng];
  }
  const fromCity = CITY_COORDS[input.city];
  if (fromCity) {
    const [jx, jy] = jitter(input.id);
    return [fromCity[0] + jx, fromCity[1] + jy];
  }
  const fromSub = SUBMARKET_COORDS[input.submarketId];
  if (fromSub) {
    const [jx, jy] = jitter(input.id);
    return [fromSub[0] + jx, fromSub[1] + jy];
  }
  return null;
}

export function coordsForSubmarket(id: string): [number, number] | null {
  return SUBMARKET_COORDS[id] ?? null;
}
