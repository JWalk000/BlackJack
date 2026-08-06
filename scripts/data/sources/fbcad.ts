/**
 * Fort Bend CAD parcels — free public ArcGIS FeatureServer (Sugar Land / Katy SW / Rosenberg).
 * https://gisportal.fortbendcountytx.gov/arcgis/rest/services/InteractiveMap/Parcels_Public/FeatureServer/1
 */
import { centroidOfRings } from "../lib/geo";
import { fetchJson, writeJson } from "../lib/io";
import {
  classifyFromValues,
  GOV_OWNER,
  num,
  str,
  type HoustonParcel,
} from "../lib/types";

const FBCAD_LAYER =
  "https://gisportal.fortbendcountytx.gov/arcgis/rest/services/InteractiveMap/Parcels_Public/FeatureServer/1/query";

const OUT_FIELDS = [
  "CADReferenceNumber",
  "OwnerName",
  "OwnerAddress1",
  "OwnerCity",
  "OwnerState",
  "Situs",
  "LandValue",
  "ImprovementValue",
  "TotalValue",
  "LandSizeAC",
  "LandSizeFT",
  "YearBuilt",
  "TotalLivingAreaSqFT",
  "LandStateCode",
].join(",");

type ArcGisFeature = {
  attributes: Record<string, string | number | null>;
  geometry?: { rings?: number[][][] };
};

type ArcGisQuery = {
  features?: ArcGisFeature[];
  error?: { message?: string };
};

function parseCityFromSitus(situs: string | null): string {
  if (!situs) return "Fort Bend";
  // e.g. "West ST, Rosenberg, TX  77471"
  const parts = situs.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const city = parts[1]?.replace(/\s+TX.*$/i, "").trim();
    if (city) return city;
  }
  return "Fort Bend";
}

async function queryFbcad(
  where: string,
  limit: number,
): Promise<ArcGisFeature[]> {
  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(limit),
    f: "json",
  });
  const data = await fetchJson<ArcGisQuery>(`${FBCAD_LAYER}?${params}`, {
    timeoutMs: 90_000,
  });
  if (data.error) throw new Error(data.error.message ?? "FBCAD query error");
  return data.features ?? [];
}

function mapFeature(f: ArcGisFeature): HoustonParcel | null {
  const a = f.attributes;
  const apn = str(a.CADReferenceNumber);
  if (!apn) return null;
  const owner = str(a.OwnerName);
  if (owner && GOV_OWNER.test(owner)) return null;

  const landValue = num(a.LandValue);
  const improvementValue = num(a.ImprovementValue);
  if (landValue <= 0) return null;

  const lotSf = num(a.LandSizeFT) || null;
  const acres =
    num(a.LandSizeAC) ||
    (lotSf ? Math.round((lotSf / 43560) * 1000) / 1000 : null);
  const stateClass = str(a.LandStateCode);
  const kindHint = classifyFromValues(
    landValue,
    improvementValue,
    lotSf,
    stateClass,
  );
  if (!kindHint) return null;

  const center = centroidOfRings(f.geometry?.rings);
  const situs = str(a.Situs);

  return {
    source: "fbcad",
    county: "Fort Bend",
    apn,
    ownerName: owner,
    mailAddr: str(a.OwnerAddress1),
    mailCity: str(a.OwnerCity),
    mailState: str(a.OwnerState),
    address: situs ?? apn,
    city: parseCityFromSitus(situs),
    zip: null,
    landValue,
    improvementValue,
    totalAssessed: num(a.TotalValue) || landValue + improvementValue,
    stateClass,
    landUse: stateClass,
    acres,
    lotSf,
    yearBuilt: num(a.YearBuilt) || null,
    livingSf: num(a.TotalLivingAreaSqFT) || null,
    lat: center?.lat ?? null,
    lng: center?.lng ?? null,
    kindHint,
  };
}

export async function pullFbcadCandidates(opts?: {
  vacantLimit?: number;
  teardownLimit?: number;
  underLimit?: number;
}): Promise<HoustonParcel[]> {
  const vacantLimit = opts?.vacantLimit ?? 80;
  const teardownLimit = opts?.teardownLimit ?? 80;
  const underLimit = opts?.underLimit ?? 40;

  console.log("[fbcad] Fort Bend CAD — vacant / land-only…");
  const vacant = await queryFbcad(
    "LandValue > 25000 AND LandValue < 2500000 AND ImprovementValue = 0",
    vacantLimit * 2,
  );

  console.log("[fbcad] Fort Bend CAD — teardown (land >> improv)…");
  const teardown = await queryFbcad(
    "LandValue > 60000 AND LandValue < 1500000 AND ImprovementValue > 0 AND ImprovementValue < LandValue * 0.2",
    teardownLimit * 2,
  );

  console.log("[fbcad] Fort Bend CAD — underimproved large lots…");
  const under = await queryFbcad(
    "LandValue > 40000 AND LandValue < 1500000 AND ImprovementValue > 0 AND ImprovementValue < LandValue * 0.45 AND LandSizeFT >= 8000",
    underLimit * 2,
  );

  const byApn = new Map<string, HoustonParcel>();
  for (const f of [...vacant, ...teardown, ...under]) {
    const p = mapFeature(f);
    if (!p) continue;
    const existing = byApn.get(p.apn);
    if (!existing || (p.lat != null && existing.lat == null)) {
      byApn.set(p.apn, p);
    }
  }

  const parcels = [...byApn.values()];
  writeJson("parcels-fbcad.json", {
    source: "Fort Bend County public parcels FeatureServer",
    market: "houston",
    real: true,
    notes: "Live FBCAD assessor values via county open GIS — not MLS",
    pulledAt: new Date().toISOString(),
    count: parcels.length,
    parcels,
  });
  console.log(`[fbcad] ${parcels.length} real Fort Bend parcels`);
  return parcels;
}
