/** Shared free-parcel shape for Houston-metro CAD loads */
export type HoustonParcel = {
  source: "hcad" | "fbcad";
  county: string;
  apn: string;
  ownerName: string | null;
  mailAddr: string | null;
  mailCity: string | null;
  mailState: string | null;
  address: string;
  city: string;
  zip: string | null;
  landValue: number;
  improvementValue: number;
  totalAssessed: number;
  stateClass: string | null;
  landUse: string | null;
  acres: number | null;
  lotSf: number | null;
  yearBuilt: number | null;
  livingSf: number | null;
  lat: number | null;
  lng: number | null;
  kindHint: "vacant_land" | "teardown" | "underimproved" | null;
};

export const GOV_OWNER =
  /\b(city of|county of|state of|harris county|fort bend|united states|houston isd|isd|municipal|utility|flood control|txdot|metro\b|port of|housing authority|redevelopment|school district|water authority|mud\b)\b/i;

export function classifyFromValues(
  land: number,
  impr: number,
  lotSf: number | null,
  stateClass: string | null,
): HoustonParcel["kindHint"] {
  const use = (stateClass ?? "").toUpperCase();
  const vacantClass = /^C/i.test(use) || use.includes("VAC");
  if (land > 0 && (impr <= 0 || vacantClass)) return "vacant_land";
  if (land > 0 && impr > 0) {
    const ratio = impr / land;
    if (ratio < 0.2) return "teardown";
    if (ratio < 0.45 && (lotSf ?? 0) >= 8000) return "underimproved";
  }
  return null;
}

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
