/**
 * Curated submarket seeds for deal finding.
 * Product focus: residential (SF / smallplex / townhome) + multifamily.
 * Sources to refresh: Census ACS, ZHVI, Redfin, HUD FMR, county CAD.
 */

export type MarketId = "houston" | "virginia";

/** Asset classes Estate underwrites */
export type ProductCategory = "residential" | "multifamily";

export type ProductType =
  | "for_sale_sf"
  | "btr_sf"
  | "duplex_quad"
  | "townhome"
  | "garden_mf"
  | "midrise_mf";

export const PRODUCT_META: Record<
  ProductType,
  { label: string; category: ProductCategory; blurb: string }
> = {
  for_sale_sf: {
    label: "Single-family flip",
    category: "residential",
    blurb: "Detached house, teardown rebuild, or rehab and resell",
  },
  btr_sf: {
    label: "Build-to-rent SF",
    category: "residential",
    blurb: "Hold as rental SF; exit on rent / BRRRR metrics",
  },
  duplex_quad: {
    label: "Duplex – fourplex",
    category: "residential",
    blurb: "Small multi-unit residential (2–4 doors)",
  },
  townhome: {
    label: "Townhome",
    category: "residential",
    blurb: "Fee-simple or condo attached product",
  },
  garden_mf: {
    label: "Garden apartments",
    category: "multifamily",
    blurb: "Walk-up / garden apartment community",
  },
  midrise_mf: {
    label: "Mid-rise multifamily",
    category: "multifamily",
    blurb: "Wood / podium multifamily denser product",
  },
};

export type Submarket = {
  id: string;
  marketId: MarketId;
  name: string;
  state: string;
  county: string;
  milesFromAnchor: number;
  /** Typical finished $/sf exit for for-sale product proxy */
  salePsf: number;
  typicalUnitSf: number;
  landPsf: number;
  notes?: string;
};

export type BuildCostBand = {
  marketId: MarketId;
  productType: ProductType;
  label: string;
  hardCostPsf: number;
  softPct: number;
  contingencyPct: number;
};

export const MARKETS: Record<
  MarketId,
  { label: string; anchor: string; radiusNote: string; asOf: string }
> = {
  houston: {
    label: "Houston + 100 mi",
    anchor: "Downtown Houston",
    radiusNote:
      "Residential and multifamily across Harris and nearby metros within ~100 miles (Katy, Woodlands, Conroe, Galveston, Sugar Land, etc.)",
    asOf: "2026-Q1 curated",
  },
  virginia: {
    label: "Northern VA → Richmond",
    anchor: "Arlington / NOVA",
    radiusNote:
      "SF, small multi, and apartments along I-95 / Route 1 from NOVA through Fredericksburg into Richmond MSA",
    asOf: "2026-Q1 curated",
  },
};

function costs(
  marketId: MarketId,
  productType: ProductType,
  hardCostPsf: number,
  softPct: number,
  contingencyPct: number,
): BuildCostBand {
  return {
    marketId,
    productType,
    label: PRODUCT_META[productType].label,
    hardCostPsf,
    softPct,
    contingencyPct,
  };
}

export const BUILD_COSTS: BuildCostBand[] = [
  costs("houston", "for_sale_sf", 140, 0.12, 0.06),
  costs("houston", "btr_sf", 145, 0.14, 0.06),
  costs("houston", "duplex_quad", 150, 0.14, 0.07),
  costs("houston", "townhome", 155, 0.15, 0.07),
  costs("houston", "garden_mf", 165, 0.16, 0.07),
  costs("houston", "midrise_mf", 220, 0.18, 0.08),
  costs("virginia", "for_sale_sf", 170, 0.13, 0.07),
  costs("virginia", "btr_sf", 175, 0.15, 0.07),
  costs("virginia", "duplex_quad", 180, 0.15, 0.07),
  costs("virginia", "townhome", 185, 0.16, 0.07),
  costs("virginia", "garden_mf", 195, 0.17, 0.08),
  costs("virginia", "midrise_mf", 275, 0.19, 0.09),
];

export function productsByCategory(marketId: MarketId) {
  const bands = BUILD_COSTS.filter((b) => b.marketId === marketId);
  return {
    residential: bands.filter(
      (b) => PRODUCT_META[b.productType].category === "residential",
    ),
    multifamily: bands.filter(
      (b) => PRODUCT_META[b.productType].category === "multifamily",
    ),
  };
}

export const SUBMARKETS: Submarket[] = [
  {
    id: "hou-inner",
    marketId: "houston",
    name: "Inner Loop / Midtown / EaDo",
    state: "TX",
    county: "Harris",
    milesFromAnchor: 3,
    salePsf: 320,
    typicalUnitSf: 900,
    landPsf: 55,
    notes: "Higher exit, tighter sites — teardowns and infill SF/MF",
  },
  {
    id: "hou-heights",
    marketId: "houston",
    name: "Houston Heights / Montrose fringe",
    state: "TX",
    county: "Harris",
    milesFromAnchor: 5,
    salePsf: 340,
    typicalUnitSf: 950,
    landPsf: 60,
  },
  {
    id: "hou-energy",
    marketId: "houston",
    name: "Energy Corridor / Memorial",
    state: "TX",
    county: "Harris",
    milesFromAnchor: 14,
    salePsf: 275,
    typicalUnitSf: 1000,
    landPsf: 35,
  },
  {
    id: "hou-katy",
    marketId: "houston",
    name: "Katy / Cinco Ranch",
    state: "TX",
    county: "Harris / Fort Bend",
    milesFromAnchor: 28,
    salePsf: 230,
    typicalUnitSf: 1100,
    landPsf: 22,
  },
  {
    id: "hou-sugar",
    marketId: "houston",
    name: "Sugar Land / Missouri City",
    state: "TX",
    county: "Fort Bend",
    milesFromAnchor: 20,
    salePsf: 245,
    typicalUnitSf: 1050,
    landPsf: 28,
  },
  {
    id: "hou-pearland",
    marketId: "houston",
    name: "Pearland / Friendswood",
    state: "TX",
    county: "Brazoria / Harris",
    milesFromAnchor: 18,
    salePsf: 235,
    typicalUnitSf: 1050,
    landPsf: 24,
  },
  {
    id: "hou-woodlands",
    marketId: "houston",
    name: "The Woodlands / Spring",
    state: "TX",
    county: "Montgomery / Harris",
    milesFromAnchor: 28,
    salePsf: 255,
    typicalUnitSf: 1050,
    landPsf: 30,
  },
  {
    id: "hou-conroe",
    marketId: "houston",
    name: "Conroe / Willis",
    state: "TX",
    county: "Montgomery",
    milesFromAnchor: 40,
    salePsf: 205,
    typicalUnitSf: 1150,
    landPsf: 14,
  },
  {
    id: "hou-league",
    marketId: "houston",
    name: "League City / Clear Lake",
    state: "TX",
    county: "Galveston / Harris",
    milesFromAnchor: 25,
    salePsf: 225,
    typicalUnitSf: 1100,
    landPsf: 20,
  },
  {
    id: "hou-galveston",
    marketId: "houston",
    name: "Galveston Island",
    state: "TX",
    county: "Galveston",
    milesFromAnchor: 50,
    salePsf: 260,
    typicalUnitSf: 900,
    landPsf: 32,
    notes: "Insurance / flood load — stress costs in live underwriting",
  },
  {
    id: "hou-baytown",
    marketId: "houston",
    name: "Baytown / Highlands",
    state: "TX",
    county: "Harris / Chambers",
    milesFromAnchor: 25,
    salePsf: 185,
    typicalUnitSf: 1050,
    landPsf: 12,
  },
  {
    id: "hou-cypress",
    marketId: "houston",
    name: "Cypress / Tomball",
    state: "TX",
    county: "Harris",
    milesFromAnchor: 26,
    salePsf: 220,
    typicalUnitSf: 1100,
    landPsf: 18,
  },
  {
    id: "hou-rosenberg",
    marketId: "houston",
    name: "Rosenberg / Richmond TX",
    state: "TX",
    county: "Fort Bend",
    milesFromAnchor: 32,
    salePsf: 200,
    typicalUnitSf: 1150,
    landPsf: 12,
  },
  {
    id: "hou-brenham",
    marketId: "houston",
    name: "Brenham / Washington Co.",
    state: "TX",
    county: "Washington",
    milesFromAnchor: 75,
    salePsf: 175,
    typicalUnitSf: 1200,
    landPsf: 8,
  },
  {
    id: "hou-huntsville",
    marketId: "houston",
    name: "Huntsville",
    state: "TX",
    county: "Walker",
    milesFromAnchor: 70,
    salePsf: 170,
    typicalUnitSf: 1150,
    landPsf: 7,
  },
  {
    id: "va-arlington",
    marketId: "virginia",
    name: "Arlington / Ballston–Crystal City",
    state: "VA",
    county: "Arlington",
    milesFromAnchor: 0,
    salePsf: 520,
    typicalUnitSf: 850,
    landPsf: 120,
    notes: "High SF and condo exits; land is expensive for rebuilds",
  },
  {
    id: "va-alex",
    marketId: "virginia",
    name: "Alexandria / Eisenhower",
    state: "VA",
    county: "Alexandria",
    milesFromAnchor: 6,
    salePsf: 480,
    typicalUnitSf: 875,
    landPsf: 100,
  },
  {
    id: "va-fairfax",
    marketId: "virginia",
    name: "Fairfax / Tysons fringe",
    state: "VA",
    county: "Fairfax",
    milesFromAnchor: 12,
    salePsf: 430,
    typicalUnitSf: 950,
    landPsf: 85,
  },
  {
    id: "va-loudoun",
    marketId: "virginia",
    name: "Ashburn / Loudoun",
    state: "VA",
    county: "Loudoun",
    milesFromAnchor: 28,
    salePsf: 390,
    typicalUnitSf: 1000,
    landPsf: 70,
  },
  {
    id: "va-pwc",
    marketId: "virginia",
    name: "Woodbridge / Dale City (PWC)",
    state: "VA",
    county: "Prince William",
    milesFromAnchor: 25,
    salePsf: 320,
    typicalUnitSf: 1050,
    landPsf: 45,
  },
  {
    id: "va-stafford",
    marketId: "virginia",
    name: "Stafford / Aquia",
    state: "VA",
    county: "Stafford",
    milesFromAnchor: 40,
    salePsf: 285,
    typicalUnitSf: 1100,
    landPsf: 32,
  },
  {
    id: "va-fred",
    marketId: "virginia",
    name: "Fredericksburg / Spotsylvania",
    state: "VA",
    county: "Fredericksburg / Spotsylvania",
    milesFromAnchor: 50,
    salePsf: 265,
    typicalUnitSf: 1100,
    landPsf: 25,
  },
  {
    id: "va-ashland",
    marketId: "virginia",
    name: "Ashland / Hanover",
    state: "VA",
    county: "Hanover",
    milesFromAnchor: 85,
    salePsf: 245,
    typicalUnitSf: 1150,
    landPsf: 18,
  },
  {
    id: "va-henrico",
    marketId: "virginia",
    name: "Short Pump / Henrico",
    state: "VA",
    county: "Henrico",
    milesFromAnchor: 100,
    salePsf: 270,
    typicalUnitSf: 1050,
    landPsf: 28,
  },
  {
    id: "va-richmond",
    marketId: "virginia",
    name: "Richmond City / Scott's Addition",
    state: "VA",
    county: "Richmond",
    milesFromAnchor: 100,
    salePsf: 295,
    typicalUnitSf: 900,
    landPsf: 35,
  },
  {
    id: "va-chester",
    marketId: "virginia",
    name: "Chesterfield / Midlothian",
    state: "VA",
    county: "Chesterfield",
    milesFromAnchor: 110,
    salePsf: 250,
    typicalUnitSf: 1100,
    landPsf: 20,
  },
  {
    id: "va-manassas",
    marketId: "virginia",
    name: "Manassas / Gainesville",
    state: "VA",
    county: "Prince William",
    milesFromAnchor: 32,
    salePsf: 335,
    typicalUnitSf: 1050,
    landPsf: 48,
  },
];
