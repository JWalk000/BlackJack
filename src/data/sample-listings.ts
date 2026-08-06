/**
 * Transparent demo inventory — used only when free CAD cache is empty.
 * Not live MLS or scraped listings.
 */

/** Swapable channel: free open CAD now; attom later; user paste in UI. */
export type ListingSource = "free-cad" | "user" | "sample" | "attom";

export type ListingType = "home" | "land";

export type SampleListing = {
  id: string;
  type: ListingType;
  title: string;
  address: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  price: number;
  /** Building square feet (homes) */
  buildingSf?: number;
  buildingSfSource?: "cad" | "typical-proxy" | "user" | string;
  buildingSfNote?: string;
  /** Lot acres (land; home lots may set lotAcres too) */
  acres?: number;
  lat: number;
  lng: number;
  notes?: string;
  /** free-cad | user | sample | attom (future) */
  source?: ListingSource;
  /** Underlying provider: hcad | fbcad | zhvi | demo | … */
  provider?: string;
  apn?: string;
  priceLabel?: string;
  priceMethod?: string;
  sourceAsOf?: string;
};

/** Primary listing shape alias. */
export type Listing = SampleListing;

export const SAMPLE_LISTINGS: SampleListing[] = [
  {
    id: "demo-home-pasadena-distress",
    type: "home",
    source: "sample",
    provider: "demo",
    title: "Pasadena brick ranch — estate sale",
    address: "4122 Red Bluff Rd",
    city: "Pasadena",
    county: "Harris",
    state: "TX",
    zip: "77503",
    price: 125000,
    buildingSf: 1680,
    acres: 0.18,
    lat: 29.6911,
    lng: -95.2091,
    notes: "Needs roof + HVAC; demo screening lead",
  },
  {
    id: "demo-home-humble-formo",
    type: "home",
    source: "sample",
    provider: "demo",
    title: "Humble 3/2 near Hardy",
    address: "18904 Forest Glade Dr",
    city: "Humble",
    county: "Harris",
    state: "TX",
    zip: "77346",
    price: 98000,
    buildingSf: 1420,
    lat: 30.0012,
    lng: -95.2621,
    notes: "As-is; dated kitchen",
  },
  {
    id: "demo-home-baytown-tearout",
    type: "home",
    source: "sample",
    provider: "demo",
    title: "Baytown fixer",
    address: "704 N Alexander Dr",
    city: "Baytown",
    county: "Harris",
    state: "TX",
    zip: "77520",
    price: 89000,
    buildingSf: 1240,
    lat: 29.7355,
    lng: -94.9774,
  },
  {
    id: "demo-home-conroe-invest",
    type: "home",
    source: "sample",
    provider: "demo",
    title: "Conroe stock-job",
    address: "602 N 6th St",
    city: "Conroe",
    county: "Montgomery",
    state: "TX",
    zip: "77301",
    price: 95000,
    buildingSf: 1380,
    lat: 30.3119,
    lng: -95.4561,
  },
  {
    id: "demo-home-rosenberg-value",
    type: "home",
    source: "sample",
    provider: "demo",
    title: "Rosenberg cottage",
    address: "1403 First St",
    city: "Rosenberg",
    county: "Fort Bend",
    state: "TX",
    zip: "77471",
    price: 110000,
    buildingSf: 1510,
    lat: 29.5516,
    lng: -95.8086,
  },
  {
    id: "demo-home-heights-retail",
    type: "home",
    source: "sample",
    provider: "demo",
    title: "Heights bungalow (retail ask)",
    address: "819 W 22nd St",
    city: "Houston",
    county: "Harris",
    state: "TX",
    zip: "77008",
    price: 485000,
    buildingSf: 1620,
    lat: 29.8055,
    lng: -95.4092,
    notes: "Market-rate ask — fails 50% hurdle by design",
  },
  {
    id: "demo-home-sugarland-turnkey",
    type: "home",
    source: "sample",
    provider: "demo",
    title: "Sugar Land updated 4/2",
    address: "3514 Lone Shadow Ln",
    city: "Sugar Land",
    county: "Fort Bend",
    state: "TX",
    zip: "77479",
    price: 425000,
    buildingSf: 2450,
    lat: 29.5852,
    lng: -95.6144,
  },
  {
    id: "demo-home-leaguecity-mid",
    type: "home",
    source: "sample",
    provider: "demo",
    title: "League City mid-ask",
    address: "2208 Brittany Ln",
    city: "League City",
    county: "Galveston",
    state: "TX",
    zip: "77573",
    price: 310000,
    buildingSf: 1980,
    lat: 29.5075,
    lng: -95.0949,
  },
  {
    id: "demo-land-waller-tract",
    type: "land",
    source: "sample",
    provider: "demo",
    title: "Waller County 12-acre tract",
    address: "FM 362 & Prairie Rd (approx)",
    city: "Prairie View",
    county: "Waller",
    state: "TX",
    zip: "77446",
    price: 420000,
    acres: 12,
    lat: 30.0933,
    lng: -95.9877,
    notes: "Raw ag land; demo good $/acre vs proxy",
  },
  {
    id: "demo-land-montgomery-raw",
    type: "land",
    source: "sample",
    provider: "demo",
    title: "Magnolia 5.2-acre raw",
    address: "Nichols Sawmill Rd corridor",
    city: "Magnolia",
    county: "Montgomery",
    state: "TX",
    zip: "77354",
    price: 280000,
    acres: 5.2,
    lat: 30.2105,
    lng: -95.7508,
  },
  {
    id: "demo-land-brazoria-farms",
    type: "land",
    source: "sample",
    provider: "demo",
    title: "Brazoria farm parcel",
    address: "CR 48 area",
    city: "Alvin",
    county: "Brazoria",
    state: "TX",
    zip: "77511",
    price: 195000,
    acres: 4.1,
    lat: 29.4238,
    lng: -95.2441,
  },
  {
    id: "demo-land-katy-premium",
    type: "land",
    source: "sample",
    provider: "demo",
    title: "Katy edge pad-ready (above avg)",
    address: "I-10 / Pin Oak corridor",
    city: "Katy",
    county: "Harris",
    state: "TX",
    zip: "77494",
    price: 2200000,
    acres: 3.5,
    lat: 29.7858,
    lng: -95.8244,
    notes: "Premium retail-path land — fails area hurdle",
  },
  {
    id: "demo-land-galveston-coastal",
    type: "land",
    source: "sample",
    provider: "demo",
    title: "Galveston island lot",
    address: "West End / Offatts corridor",
    city: "Galveston",
    county: "Galveston",
    state: "TX",
    zip: "77554",
    price: 175000,
    acres: 0.35,
    lat: 29.2402,
    lng: -94.9327,
  },
  {
    id: "demo-land-fortbend-utility",
    type: "land",
    source: "sample",
    provider: "demo",
    title: "Fulshear 8-acre infill",
    address: "FM 1093 vicinity",
    city: "Fulshear",
    county: "Fort Bend",
    state: "TX",
    zip: "77441",
    price: 980000,
    acres: 8,
    lat: 29.6899,
    lng: -95.8997,
  },
];
