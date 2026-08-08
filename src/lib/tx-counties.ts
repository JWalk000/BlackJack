/**
 * TX city → county guesses for free comps (Houston metro + common suburbs).
 */

const CITY_COUNTY: Record<string, string> = {
  houston: "Harris",
  pasadena: "Harris",
  bellaire: "Harris",
  "west university place": "Harris",
  "west u": "Harris",
  spring: "Harris",
  cypress: "Harris",
  katy: "Harris",
  humble: "Harris",
  baytown: "Harris",
  "jersey village": "Harris",
  tomball: "Harris",
  alief: "Harris",
  "sugar land": "Fort Bend",
  sugarland: "Fort Bend",
  "missouri city": "Fort Bend",
  stafford: "Fort Bend",
  richmond: "Fort Bend",
  rosenberg: "Fort Bend",
  "the woodlands": "Montgomery",
  conroe: "Montgomery",
  magnolia: "Montgomery",
  pearland: "Brazoria",
  alvin: "Brazoria",
  "league city": "Galveston",
  galveston: "Galveston",
  friendswood: "Galveston",
  waller: "Waller",
  brookshire: "Waller",
};

export function guessCounty(city: string, state = "TX"): string | null {
  if (!city || state.toUpperCase() !== "TX") return null;
  const key = city.trim().toLowerCase();
  return CITY_COUNTY[key] ?? null;
}
