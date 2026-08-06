export type User = {
  id: string;
  name: string;
  email: string;
  /** @deprecated plain passwords from older local storage — migrated on sign-in */
  password?: string;
  passwordHash?: string;
  salt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type Session = {
  userId: string;
  email: string;
  name: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

export type DocType =
  | "agreement"
  | "title"
  | "environmental"
  | "survey"
  | "other";

export type DocStatus =
  | "queued"
  | "reviewing"
  | "clear"
  | "review"
  | "issue";

export type Finding = {
  id: string;
  severity: "info" | "warn" | "critical";
  text: string;
};

export type ProjectDocument = {
  id: string;
  name: string;
  type: DocType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  status: DocStatus;
  findings: Finding[];
  excerpt?: string;
};

export type ScheduleTask = {
  id: string;
  phase: string;
  name: string;
  start: number;
  duration: number;
  progress: number;
  status: "on-track" | "at-risk" | "done" | "delayed";
};

export type ProjectStatus = "planning" | "diligence" | "execution";

export type PropertyInfo = {
  propertyName: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  apn: string;
  ownerName: string;
  ownerMailing: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  units: number | null;
  propertyType: string;
  lotAcres: number | null;
  lotSf: number | null;
  zoning: string;
  ownerOccupied: boolean | null;
  estValue: number | null;
  lastSaleAmount: number | null;
  lastSaleDate: string;
  taxAssessment: number | null;
  landValue: number | null;
  improvementValue: number | null;
  taxYear: string;
};

/** Categories for itemized build / remodel budgets */
export type CostItemCategory =
  | "demolition"
  | "structure"
  | "envelope"
  | "mechanical"
  | "interior"
  | "kitchens"
  | "baths"
  | "exterior"
  | "site"
  | "soft"
  | "contingency"
  | "other";

export type CostLineItem = {
  id: string;
  category: CostItemCategory;
  name: string;
  amount: number;
  notes?: string;
};

export type UnderwritingAssumptions = {
  purchasePrice: number;
  closingCosts: number;
  holdingCosts: number;
  rehabBudget: number;
  rehabMonths: number;
  financing: "all-cash" | "hard-money";
  downPaymentPct: number;
  arv: number;
  monthsToSale: number;
  costOfSalePct: number;
  resalePrice: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthsToRent: number;
  refinance: boolean;
  /**
   * Optional line-by-line build / remodel detail.
   * When present, rehabBudget should equal the sum of amounts.
   */
  costItems?: CostLineItem[];
};

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  region: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  documents: ProjectDocument[];
  schedule: ScheduleTask[];
  property?: PropertyInfo;
  underwriting?: UnderwritingAssumptions;
  /** Origin lead id from Deal Finder when project was started from a deal */
  sourceLeadId?: string;
  productType?: string;
  planNotes?: string;
};
