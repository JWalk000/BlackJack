/**
 * Harris County CAD parcels — free ArcGIS MapServer (no API key).
 * Real assessor attributes + parcel geometry for Houston + Harris County.
 * https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0
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

const HCAD_LAYER =
  "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query";

const OUT_FIELDS = [
  "HCAD_NUM",
  "owner_name_1",
  "mail_addr_1",
  "mail_city",
  "mail_state",
  "site_str_num",
  "site_str_name",
  "site_str_sfx",
  "site_city",
  "site_zip",
  "land_value",
  "impr_value",
  "bld_value",
  "total_appraised_val",
  "total_market_val",
  "state_class",
  "Acreage",
  "land_sqft",
  "land_use",
  "new_owner_date",
].join(",");

type ArcGisFeature = {
  attributes: Record<string, string | number | null>;
  geometry?: { rings?: number[][][] };
};

type ArcGisQuery = {
  features?: ArcGisFeature[];
  error?: { message?: string };
};

// legacy alias
export type HcadRawParcel = HoustonParcel;

function buildAddress(a: Record<string, string | number | null>): string {
  const numPart = str(a.site_str_num);
  const name = str(a.site_str_name);
  const sfx = str(a.site_str_sfx);
  if (!name) return str(a.HCAD_NUM) ?? "Unknown parcel";
  return [numPart && numPart !== "0" ? numPart : null, name, sfx]
    .filter(Boolean)
    .join(" ");
}

async function queryHcad(
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
  const data = await fetchJson<ArcGisQuery>(`${HCAD_LAYER}?${params}`, {
    timeoutMs: 90_000,
  });
  if (data.error) throw new Error(data.error.message ?? "HCAD query error");
  return data.features ?? [];
}

function mapFeature(f: ArcGisFeature): HoustonParcel | null {
  const a = f.attributes;
  const apn = str(a.HCAD_NUM);
  if (!apn) return null;
  const owner = str(a.owner_name_1);
  if (owner && GOV_OWNER.test(owner)) return null;

  const landValue = num(a.land_value);
  const improvementValue = num(a.impr_value) || num(a.bld_value);
  if (landValue <= 0) return null;

  const lotSf = num(a.land_sqft) || null;
  const acres =
    num(a.Acreage) ||
    (lotSf ? Math.round((lotSf / 43560) * 1000) / 1000 : null);
  const stateClass = str(a.state_class);
  const kindHint = classifyFromValues(
    landValue,
    improvementValue,
    lotSf,
    stateClass,
  );
  if (!kindHint) return null;

  const center = centroidOfRings(f.geometry?.rings);

  return {
    source: "hcad",
    county: "Harris",
    apn,
    ownerName: owner,
    mailAddr: str(a.mail_addr_1),
    mailCity: str(a.mail_city),
    mailState: str(a.mail_state),
    address: buildAddress(a),
    city: str(a.site_city) ?? "Houston",
    zip: str(a.site_zip),
    landValue,
    improvementValue,
    totalAssessed:
      num(a.total_market_val) ||
      num(a.total_appraised_val) ||
      landValue + improvementValue,
    stateClass,
    landUse: str(a.land_use) ?? stateClass,
    acres,
    lotSf,
    yearBuilt: null,
    livingSf: null,
    lat: center?.lat ?? null,
    lng: center?.lng ?? null,
    kindHint,
  };
}

export async function pullHcadCandidates(opts?: {
  vacantLimit?: number;
  teardownLimit?: number;
  underLimit?: number;
}): Promise<HoustonParcel[]> {
  const vacantLimit = opts?.vacantLimit ?? 100;
  const teardownLimit = opts?.teardownLimit ?? 100;
  const underLimit = opts?.underLimit ?? 50;

  console.log("[hcad] Harris CAD — vacant / land-only…");
  const vacant = await queryHcad(
    "land_value > 25000 AND land_value < 2500000 AND (impr_value = 0 OR state_class LIKE 'C%')",
    vacantLimit * 2,
  );

  console.log("[hcad] Harris CAD — teardown (land >> improv)…");
  const teardown = await queryHcad(
    "land_value > 60000 AND land_value < 1500000 AND impr_value > 0 AND impr_value < land_value * 0.2",
    teardownLimit * 2,
  );

  console.log("[hcad] Harris CAD — underimproved large lots…");
  const under = await queryHcad(
    "land_value > 40000 AND land_value < 1500000 AND impr_value > 0 AND impr_value < land_value * 0.45 AND land_sqft >= 8000",
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
  writeJson("parcels-hcad.json", {
    source: "Harris County CAD parcels MapServer",
    market: "houston",
    real: true,
    notes: "Live assessor values from HCAD open GIS — not MLS listings",
    pulledAt: new Date().toISOString(),
    count: parcels.length,
    parcels,
  });
  console.log(`[hcad] ${parcels.length} real Harris parcels`);
  return parcels;
}
