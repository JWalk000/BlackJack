export type BuildMode = "new_build" | "rehab";
export type PropertyClass = "residential" | "commercial";
export type ExitStrategy = "flip" | "hold";

export type CostItem = {
  id: string;
  category: string;
  label: string;
  amount: number;
  notes?: string;
};

export type PropertyInfo = {
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  apn: string;
  bedrooms: number | null;
  bathsFull: number | null;
  bathsHalf: number | null;
  yearBuilt: number | null;
  buildingSf: number | null;
  lotSf: number | null;
  units: number | null;
  floors: number | null;
  propertyType: string;
  zoning: string;
  condition: string;
  lastSaleAmount: number | null;
  lastSaleDate: string;
  taxAssessment: number | null;
  taxAmount: number | null;
};

export type Financing = {
  style: "all_cash" | "hard_money" | "conventional";
  ltvPct: number;
  interestRatePct: number;
  pointsPct: number;
  termMonths: number;
};

export type DealAssumptions = {
  purchasePrice: number;
  closingCosts: number;
  /** When true, user overrode closing $; don't auto-apply 4% of exit value */
  closingCostsManual: boolean;
  projectMonths: number;
  monthsToSaleOrRent: number;
  costOfSalePct: number;
  arv: number;
  /** Monthly rent (hold) */
  grossRentMonthly: number;
  /** Other monthly income */
  otherIncomeMonthly: number;
  vacancyPct: number;
  operatingExpensesMonthly: number;
  refinance: boolean;
  permanentLtvPct: number;
  permanentRatePct: number;
  permanentTermYears: number;
};

/** Simple build phase — schedule without Gantt complexity. */
export type ProjectPhase = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** 0–100 */
  progressPct: number;
};

export type ProjectFileKind = "photo" | "document" | "other";

/** File metadata on the deal; bytes live in IndexedDB and/or Supabase Storage. */
export type ProjectFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  kind: ProjectFileKind;
  /** Where bytes are stored for this device/session. */
  storage: "local" | "cloud" | "both";
  /** Path inside Supabase bucket `deal-files` when storage includes cloud. */
  cloudPath?: string | null;
};

/**
 * Post-underwrite project execution (keep thin — files, phases, one notes field).
 */
export type DealProject = {
  phases: ProjectPhase[];
  notes: string;
  files: ProjectFile[];
};

export type Deal = {
  id: string;
  createdAt: string;
  updatedAt: string;
  buildMode: BuildMode;
  propertyClass: PropertyClass;
  exitStrategy: ExitStrategy;
  property: PropertyInfo;
  assumptions: DealAssumptions;
  financing: Financing;
  costItems: CostItem[];
  /** Build execution: schedule, files, job notes. */
  project: DealProject;
  /**
   * When set, deal is shared with the whole team (cloud column user_deals.team_id).
   * Personal free-deal limits still apply to creates owned by free users.
   */
  teamId?: string | null;
  /** Cloud row owner — set when loaded from cloud for delete/share UI. */
  ownerUserId?: string | null;
};

export type CostTemplateRow = {
  category: string;
  label: string;
  notes?: string;
};

/** Ordered cost categories for UI grouping (soft → hard → optional). */
export const COST_CATEGORY_ORDER = [
  "Soft costs & margin",
  "Soft costs",
  "Hard construction",
  "MEP rough-ins",
  "Hard · CSI divisions",
  "Optional",
  "Custom",
  "Other",
] as const;

/**
 * Residential single-family style itemization (NAHB structure).
 * Amounts are always user-entered — no survey prices baked in.
 */
export const RESIDENTIAL_NEW_BUILD_COSTS: CostTemplateRow[] = [
  // Soft costs & builder margin
  {
    category: "Soft costs & margin",
    label: "Finished lot / land cost",
    notes: "Land into the pro forma",
  },
  {
    category: "Soft costs & margin",
    label: "Builder overhead & general admin",
  },
  {
    category: "Soft costs & margin",
    label: "Sales commission",
  },
  {
    category: "Soft costs & margin",
    label: "Architecture & engineering",
  },
  {
    category: "Soft costs & margin",
    label: "Building permit fees",
  },
  {
    category: "Soft costs & margin",
    label: "Impact / school / fire district fees",
  },
  {
    category: "Soft costs & margin",
    label: "Water & sewer tap / utility hookup",
  },
  {
    category: "Soft costs & margin",
    label: "Construction loan interest / financing",
  },
  {
    category: "Soft costs & margin",
    label: "Marketing",
  },
  {
    category: "Soft costs & margin",
    label: "Builder profit (pre-tax)",
  },
  // Hard construction
  {
    category: "Hard construction",
    label: "Site work",
    notes: "Grading, utilities stub, temporary services",
  },
  {
    category: "Hard construction",
    label: "Foundations",
  },
  {
    category: "Hard construction",
    label: "Framing (lumber + labor)",
  },
  {
    category: "Hard construction",
    label: "Exterior finishes",
    notes: "Siding, roofing, windows, doors",
  },
  {
    category: "MEP rough-ins",
    label: "Plumbing",
  },
  {
    category: "MEP rough-ins",
    label: "Electrical",
  },
  {
    category: "MEP rough-ins",
    label: "HVAC",
  },
  {
    category: "Hard construction",
    label: "Interior finishes",
    notes: "Cabinets, drywall, flooring, trim, paint",
  },
  {
    category: "Hard construction",
    label: "Final steps",
    notes: "Landscaping, driveway, outdoor structures",
  },
  {
    category: "Hard construction",
    label: "Contingency / cleanup / punch list",
  },
  {
    category: "Optional",
    label: "Owner contingency reserve",
    notes: "If self-managing: often 5–10% of hard construction",
  },
];

/** Residential rehab — soft builder lines + rehab hard; no finished lot */
export const RESIDENTIAL_REHAB_COSTS: CostTemplateRow[] = [
  {
    category: "Soft costs & margin",
    label: "Builder overhead & general admin",
  },
  {
    category: "Soft costs & margin",
    label: "Sales commission",
  },
  {
    category: "Soft costs & margin",
    label: "Architecture & engineering",
  },
  {
    category: "Soft costs & margin",
    label: "Building permit fees",
  },
  {
    category: "Soft costs & margin",
    label: "Impact / school / fire district fees",
  },
  {
    category: "Soft costs & margin",
    label: "Water & sewer tap / utility hookup",
  },
  {
    category: "Soft costs & margin",
    label: "Construction loan interest / financing",
  },
  {
    category: "Soft costs & margin",
    label: "Marketing",
  },
  {
    category: "Soft costs & margin",
    label: "Builder profit (pre-tax)",
  },
  {
    category: "Hard construction",
    label: "Demo & haul-off",
  },
  {
    category: "Hard construction",
    label: "Site work",
    notes: "Exterior repairs, grading, temp services",
  },
  {
    category: "Hard construction",
    label: "Foundations",
    notes: "Structural / foundation repairs",
  },
  {
    category: "Hard construction",
    label: "Framing (lumber + labor)",
    notes: "Structural remodel framing",
  },
  {
    category: "Hard construction",
    label: "Exterior finishes",
    notes: "Siding, roofing, windows, doors",
  },
  {
    category: "MEP rough-ins",
    label: "Plumbing",
  },
  {
    category: "MEP rough-ins",
    label: "Electrical",
  },
  {
    category: "MEP rough-ins",
    label: "HVAC",
  },
  {
    category: "Hard construction",
    label: "Interior finishes",
    notes: "Cabinets, drywall, flooring, trim, paint",
  },
  {
    category: "Hard construction",
    label: "Final steps",
    notes: "Landscaping, driveway, outdoor structures",
  },
  {
    category: "Hard construction",
    label: "Contingency / cleanup / punch list",
  },
  {
    category: "Optional",
    label: "Owner contingency reserve",
    notes: "If self-managing: often 5–10% of hard construction",
  },
];

const COMMERCIAL_SOFT_WITH_LAND: CostTemplateRow[] = [
  {
    category: "Soft costs",
    label: "Land acquisition",
  },
  {
    category: "Soft costs",
    label: "Architecture & engineering",
  },
  {
    category: "Soft costs",
    label: "Permits, impact fees, utility taps",
  },
  {
    category: "Soft costs",
    label: "Legal / zoning / entitlement",
  },
  {
    category: "Soft costs",
    label: "Insurance & bonds",
    notes: "GL, builder's risk, performance",
  },
  {
    category: "Soft costs",
    label: "Financing & interest carry",
    notes: "Construction loan",
  },
  {
    category: "Soft costs",
    label: "Leasing commissions & TI allowance",
  },
  {
    category: "Optional",
    label: "Owner contingency reserve",
  },
];

const COMMERCIAL_SOFT_REHAB: CostTemplateRow[] = [
  {
    category: "Soft costs",
    label: "Architecture & engineering",
  },
  {
    category: "Soft costs",
    label: "Permits, impact fees, utility taps",
  },
  {
    category: "Soft costs",
    label: "Legal / zoning / entitlement",
  },
  {
    category: "Soft costs",
    label: "Insurance & bonds",
    notes: "GL, builder's risk, performance",
  },
  {
    category: "Soft costs",
    label: "Financing & interest carry",
    notes: "Construction loan",
  },
  {
    category: "Soft costs",
    label: "Leasing commissions & TI allowance",
  },
  {
    category: "Optional",
    label: "Owner contingency reserve",
  },
];

/** Commercial hard — CSI MasterFormat style divisions */
const COMMERCIAL_CSI_HARD: CostTemplateRow[] = [
  {
    category: "Hard · CSI divisions",
    label: "Div 01 — General requirements",
    notes: "GC overhead, mobilization, superintendent",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 02 / 31 — Existing conditions & earthwork",
    notes: "Demo, grading",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 03 — Concrete",
    notes: "Footings, slab, columns, decks",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 04 — Masonry",
    notes: "Exterior skin, partitions",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 05 — Metals",
    notes: "Structural steel, decking, lintels",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 06 — Wood, plastics, composites",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 07 — Thermal & moisture",
    notes: "Roof, insulation, sealants",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 08 — Openings",
    notes: "Curtainwall, storefront, doors, hardware",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 09 — Finishes",
    notes: "Drywall, ACT, paint, flooring, tile",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 10 — Specialties",
    notes: "Toilet accessories, signage",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 11 — Equipment",
    notes: "Kitchenette, IT",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 12 — Furnishings",
    notes: "Systems furniture, window treatment",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 13 — Special construction",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 14 — Conveying",
    notes: "Elevators, lifts",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 21 — Fire suppression",
    notes: "Sprinklers, standpipes",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 22 — Plumbing",
    notes: "Domestic water, sanitary, fixtures",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 23 — HVAC",
    notes: "Chilled water, ductwork, controls",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 25 — BAS / integrated automation",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 26 — Electrical",
    notes: "Service, distribution, lighting",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 27 — Communications",
    notes: "Data, fiber, AV",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 28 — Electronic safety & security",
    notes: "Fire alarm, access, CCTV",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 32 — Exterior improvements",
    notes: "Paving, walks, landscaping",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 33 — Utilities",
    notes: "Transformer, gas, telecom",
  },
];

/** CSI hard for rehab — Div 02 / existing conditions emphasized first */
const COMMERCIAL_CSI_HARD_REHAB: CostTemplateRow[] = [
  {
    category: "Hard · CSI divisions",
    label: "Div 01 — General requirements",
    notes: "GC overhead, mobilization, superintendent",
  },
  {
    category: "Hard · CSI divisions",
    label: "Div 02 / 31 — Existing conditions & earthwork",
    notes: "Demo, abatement, grading — often heavy on rehab",
  },
  ...COMMERCIAL_CSI_HARD.filter(
    (row) =>
      !row.label.startsWith("Div 01") && !row.label.startsWith("Div 02"),
  ),
];

export const COMMERCIAL_NEW_BUILD_COSTS: CostTemplateRow[] = [
  ...COMMERCIAL_SOFT_WITH_LAND,
  ...COMMERCIAL_CSI_HARD,
];

export const COMMERCIAL_REHAB_COSTS: CostTemplateRow[] = [
  ...COMMERCIAL_SOFT_REHAB,
  ...COMMERCIAL_CSI_HARD_REHAB,
];

export function costTemplateFor(
  buildMode: BuildMode,
  propertyClass: PropertyClass,
): CostTemplateRow[] {
  if (propertyClass === "residential") {
    return buildMode === "new_build"
      ? RESIDENTIAL_NEW_BUILD_COSTS
      : RESIDENTIAL_REHAB_COSTS;
  }
  return buildMode === "new_build"
    ? COMMERCIAL_NEW_BUILD_COSTS
    : COMMERCIAL_REHAB_COSTS;
}

export const DEFAULT_PROPERTY_TYPES = {
  residential: [
    "Single family",
    "Duplex",
    "Triplex / fourplex",
    "Townhome",
    "Multifamily (5+)",
  ],
  commercial: [
    "Retail",
    "Office",
    "Industrial / warehouse",
    "Mixed-use",
    "Hospitality",
    "Land / development",
  ],
} as const;
