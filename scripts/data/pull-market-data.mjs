/**
 * Pull free public market data for Estate Deal Finder.
 *
 * Sources (not MLS scrapers; not ATTOM):
 * 1. Zillow Research ZHVI county CSV (open research files) → home $/sf benchmarks
 * 2. Harris CAD parcels (public ArcGIS) → free-cad lead sample
 * 3. Fort Bend CAD parcels (public ArcGIS)
 * 4. FHFA HPI (optional metro trend signal in cache)
 *
 * Usage:
 *   npm run data:pull
 *   node scripts/data/pull-market-data.mjs
 *   node scripts/data/pull-market-data.mjs --skip-parcels
 *   node scripts/data/pull-market-data.mjs --skip-hpi
 *
 * Writes (static imports — no client fs):
 *   src/data/generated/free-leads.json
 *   src/data/generated/area-comps-live.json
 * Cache mirrors under data/cache/
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const GENERATED = join(ROOT, "src", "data", "generated");
const CACHE = join(ROOT, "data", "cache");

/** Typical finished living area when CAD omits sqft (Harris parcels). */
const TYPICAL_HOME_SF = 1900;

/** Cap total listings for deploy size (150–300). */
const MAX_LISTINGS = 250;

const HOUSTON_COUNTIES = [
  { name: "Harris County", short: "Harris", fips: "201" },
  { name: "Fort Bend County", short: "Fort Bend", fips: "157" },
  { name: "Montgomery County", short: "Montgomery", fips: "339" },
  { name: "Brazoria County", short: "Brazoria", fips: "039" },
  { name: "Galveston County", short: "Galveston", fips: "167" },
  { name: "Waller County", short: "Waller", fips: "473" },
];

const LAND_PROXY_PER_ACRE = {
  Harris: 185000,
  "Fort Bend": 165000,
  Montgomery: 95000,
  Brazoria: 72000,
  Galveston: 88000,
  Waller: 45000,
};

const ZHVI_URL =
  "https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv";

/** Prefer FeatureServer; fall back to MapServer if GIS path changes. */
const HCAD_ENDPOINTS = [
  "https://www.gis.hctx.net/arcgishcpid/rest/services/HCAD/Parcels/FeatureServer/0/query",
  "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query",
];

const FBCAD_QUERY =
  "https://gisportal.fortbendcountytx.gov/arcgis/rest/services/InteractiveMap/Parcels_Public/FeatureServer/1/query";

const FHFA_MASTER =
  "https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv";

const FETCH_TIMEOUT_MS = 90_000;

const args = new Set(process.argv.slice(2));
const skipParcels = args.has("--skip-parcels");
const skipHpi = args.has("--skip-hpi");

function ensureDirs() {
  mkdirSync(GENERATED, { recursive: true });
  mkdirSync(CACHE, { recursive: true });
}

function parseCsvLine(line) {
  const cols = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      cols.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  cols.push(cur);
  return cols;
}

async function fetchText(url, label) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "EstateDealFinder/1.0 (research; free open data)" },
    });
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url, label) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "EstateDealFinder/1.0 (research; free open data)" },
    });
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function polygonCentroid(geometry) {
  if (!geometry) return null;
  const rings = geometry.rings || geometry.coordinates?.[0];
  if (!rings || !rings.length) {
    if (geometry.x != null && geometry.y != null) {
      return { lng: geometry.x, lat: geometry.y };
    }
    return null;
  }
  const ring = Array.isArray(rings[0]?.[0]) ? rings[0] : rings;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const pt of ring) {
    const x = pt[0];
    const y = pt[1];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      sx += x;
      sy += y;
      n++;
    }
  }
  if (!n) return null;
  return { lng: sx / n, lat: sy / n };
}

function median(nums) {
  const a = nums
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function moneyRound(n) {
  return Math.round(n);
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

async function pullZhvi() {
  console.log("[zhvi] Downloading Zillow Research ZHVI county series…");
  const csv = await fetchText(ZHVI_URL, "ZHVI");
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const dateIdxs = header
    .map((h, i) => ({ h, i }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.h));
  if (!dateIdxs.length) throw new Error("ZHVI: no date columns");
  const last = dateIdxs[dateIdxs.length - 1];
  const want = new Map(HOUSTON_COUNTIES.map((c) => [c.name, c]));

  const counties = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const regionName = cols[2];
    const state = cols[5];
    if (state !== "TX" || !want.has(regionName)) continue;
    const meta = want.get(regionName);
    let zhvi = Number(cols[last.i]);
    if (!Number.isFinite(zhvi) || zhvi <= 0) {
      for (let j = dateIdxs.length - 2; j >= 0; j--) {
        const v = Number(cols[dateIdxs[j].i]);
        if (Number.isFinite(v) && v > 0) {
          zhvi = v;
          break;
        }
      }
    }
    if (!Number.isFinite(zhvi) || zhvi <= 0) continue;
    const medianHomePsf = moneyRound(zhvi / TYPICAL_HOME_SF);
    counties.push({
      county: meta.short,
      state: "TX",
      regionName,
      metro: "Houston",
      zhvi: moneyRound(zhvi),
      typicalHomeSf: TYPICAL_HOME_SF,
      medianHomePsf,
      avgLandPerAcre: LAND_PROXY_PER_ACRE[meta.short] ?? 50000,
      landSource: "placeholder_proxy",
      landNote:
        "Land $/acre starts as Houston-metro proxy; raised from CAD vacant-parcel medians when available. ZHVI is home value, not land.",
      homeSource: "zhvi",
      homeNote: `County mid-tier ZHVI ÷ ${TYPICAL_HOME_SF} typical sf (not assessed $/sf).`,
    });
  }

  if (counties.length < 4) {
    throw new Error(`ZHVI: expected Houston counties, got ${counties.length}`);
  }

  const pulledAt = new Date().toISOString();
  const snapshot = {
    provider: "zhvi",
    source: "Zillow Research ZHVI (County, SFR+Condo mid-tier, smoothed SA)",
    sourceUrl: ZHVI_URL,
    researchPage: "https://www.zillow.com/research/data/",
    asOf: last.h,
    pulledAt,
    method: `salePsf ≈ county ZHVI ÷ ${TYPICAL_HOME_SF} typical finished sf`,
    typicalHomeSf: TYPICAL_HOME_SF,
    counties,
  };

  console.log(`[zhvi] asOf ${snapshot.asOf}: ${counties.length} counties`);
  return snapshot;
}

async function pullFhfaHpi() {
  console.log("[fhfa] Downloading FHFA hpi_master.csv…");
  const csv = await fetchText(FHFA_MASTER, "FHFA");
  const lines = csv.split(/\r?\n/);
  const header = parseCsvLine(lines[0] ?? "");
  const idx = (name) => header.indexOf(name);
  const iType = idx("hpi_type");
  const iFlavor = idx("hpi_flavor");
  const iFreq = idx("frequency");
  const iLevel = idx("level");
  const iName = idx("place_name");
  const iId = idx("place_id");
  const iYr = idx("yr");
  const iPer = idx("period");
  const iIdx = idx("index_nsa");

  const series = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (cols[iLevel] !== "MSA") continue;
    if (cols[iType] !== "traditional") continue;
    if (cols[iFlavor] !== "all-transactions") continue;
    if (cols[iFreq] !== "quarterly") continue;
    const placeId = cols[iId] ?? "";
    const placeName = (cols[iName] ?? "").replace(/^"|"$/g, "");
    if (placeId !== "26420" && !/Houston-Pasadena-The Woodlands/i.test(placeName))
      continue;
    const year = Number(cols[iYr]);
    const period = Number(cols[iPer]);
    const index = Number(cols[iIdx]);
    if (!year || !period || !Number.isFinite(index)) continue;
    series.push({ year, period, index, placeName, placeId: placeId || "26420" });
  }

  series.sort((a, b) => a.year - b.year || a.period - b.period);
  const latest = series[series.length - 1] ?? null;
  const priorYear =
    latest == null
      ? null
      : series.find(
          (p) => p.year === latest.year - 1 && p.period === latest.period,
        ) ?? null;
  const yoyPct =
    latest && priorYear
      ? Math.round(((latest.index - priorYear.index) / priorYear.index) * 1000) /
        10
      : null;

  const payload = {
    provider: "fhfa",
    source: "FHFA HPI (hpi_master.csv)",
    license: "Public domain / FHFA official release",
    researchPage: "https://www.fhfa.gov/data/hpi",
    pulledAt: new Date().toISOString(),
    metros: latest
      ? [
          {
            marketId: "houston",
            placeId: latest.placeId,
            placeName: latest.placeName || "Houston-Pasadena-The Woodlands, TX",
            frequency: "quarterly",
            flavor: "all-transactions",
            latest: {
              year: latest.year,
              period: latest.period,
              index: latest.index,
            },
            priorYear: priorYear
              ? {
                  year: priorYear.year,
                  period: priorYear.period,
                  index: priorYear.index,
                }
              : null,
            yoyPct,
          },
        ]
      : [],
  };

  writeJson(join(CACHE, "fhfa-hpi.json"), payload);
  console.log(
    `[fhfa] Houston YoY ${yoyPct ?? "n/a"}% → data/cache/fhfa-hpi.json`,
  );
  return payload;
}

function qs(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function queryArcGis(baseUrl, params, label) {
  const url = `${baseUrl}?${qs({ f: "json", ...params })}`;
  const data = await fetchJson(url, label);
  if (data.error) {
    throw new Error(`${label}: ${JSON.stringify(data.error)}`);
  }
  return data.features || [];
}

async function queryPages(baseUrl, baseParams, label, maxFeatures) {
  const out = [];
  let offset = 0;
  const page = Math.min(500, maxFeatures);
  while (out.length < maxFeatures) {
    const batch = await queryArcGis(
      baseUrl,
      {
        ...baseParams,
        resultOffset: offset,
        resultRecordCount: Math.min(page, maxFeatures - out.length),
      },
      `${label}@${offset}`,
    );
    if (!batch.length) break;
    out.push(...batch);
    offset += batch.length;
    if (batch.length < page) break;
  }
  return out;
}

async function pullHcadListings(targetHome, targetLand) {
  console.log("[hcad] Querying Harris CAD parcels…");
  // Keep outFields minimal — extra fields / string compares have failed on HCAD.
  const outFields =
    "HCAD_NUM,site_str_num,site_str_pfx,site_str_name,site_str_sfx,site_str_sfx_dir,site_city,site_zip,state_class,total_market_val,total_appraised_val,land_value,bld_value,acreage_1,land_sqft,tax_year";

  let lastError = null;
  for (const HCAD_QUERY of HCAD_ENDPOINTS) {
    try {
      // Homes and land are independent so one query failure does not drop both.
      let homes = [];
      let land = [];
      try {
        homes = await queryPages(
          HCAD_QUERY,
          {
            where:
              "state_class='A1' AND total_market_val>25000 AND total_market_val<450000 AND bld_value>5000",
            outFields,
            returnGeometry: true,
            outSR: 4326,
            orderByFields: "total_market_val ASC",
          },
          "HCAD homes",
          targetHome * 2,
        );
      } catch (e) {
        console.warn(`[hcad] homes query failed: ${e.message || e}`);
        lastError = e;
      }

      // acreage_1 is numeric; avoid string Acreage compares (GIS 400s)
      const landWheres = [
        "state_class='C1' AND total_market_val>8000 AND acreage_1>0.08",
        "state_class='C1' AND total_market_val>8000 AND land_sqft>3500",
        "state_class='C1' AND total_market_val>8000",
      ];
      for (const where of landWheres) {
        try {
          land = await queryPages(
            HCAD_QUERY,
            {
              where,
              outFields,
              returnGeometry: true,
              outSR: 4326,
              orderByFields: "total_market_val ASC",
            },
            "HCAD land",
            targetLand * 2,
          );
          if (land.length) break;
        } catch (e) {
          lastError = e;
          console.warn(`[hcad] land query failed (${where.slice(0, 40)}…): ${e.message || e}`);
        }
      }

      if (!homes.length && !land.length) {
        throw lastError || new Error("HCAD: no features");
      }

      console.log(
        `[hcad] raw homes=${homes.length} land=${land.length} via ${HCAD_QUERY.includes("FeatureServer") ? "FeatureServer" : "MapServer"}`,
      );
      return { homes, land, endpoint: HCAD_QUERY };
    } catch (e) {
      lastError = e;
      console.warn(`[hcad] endpoint failed: ${e.message || e}`);
    }
  }
  throw lastError || new Error("HCAD: all endpoints failed");
}

async function pullFbcadListings(targetHome, targetLand) {
  console.log("[fbcad] Querying Fort Bend CAD parcels…");
  const outFields =
    "PropertyNumber,CADReferenceNumber,Situs,SitusStreetNumber,SitusPRDIR,SitusStreetName,SitusStreetType,SitusPODIR,OwnerCity,OwnerZip,TotalValue,LandValue,ImprovementValue,TotalLivingAreaSqFT,LandSizeAC,YearBuilt,LandStateCode";

  const homes = await queryPages(
    FBCAD_QUERY,
    {
      where:
        "LandStateCode LIKE 'A%' AND TotalLivingAreaSqFT>500 AND ImprovementValue>5000 AND TotalValue>25000 AND TotalValue<500000",
      outFields,
      returnGeometry: true,
      outSR: 4326,
      orderByFields: "TotalValue ASC",
    },
    "FBCAD homes",
    targetHome * 2,
  );

  const land = await queryPages(
    FBCAD_QUERY,
    {
      where:
        "LandStateCode LIKE 'C%' AND LandSizeAC>0.1 AND TotalValue>8000 AND (ImprovementValue IS NULL OR ImprovementValue<5000)",
      outFields,
      returnGeometry: true,
      outSR: 4326,
      orderByFields: "TotalValue ASC",
    },
    "FBCAD land",
    targetLand * 2,
  );

  console.log(`[fbcad] raw homes=${homes.length} land=${land.length}`);
  return { homes, land };
}

function diversify(features, limit, keyFn) {
  if (features.length <= limit) return features;
  const sorted = [...features].sort((a, b) => keyFn(a) - keyFn(b));
  const step = sorted.length / limit;
  const picked = [];
  for (let i = 0; i < limit; i++) {
    picked.push(sorted[Math.min(sorted.length - 1, Math.floor(i * step))]);
  }
  return picked;
}

function hcadAddress(a) {
  const num = a.site_str_num != null ? String(a.site_str_num).trim() : "";
  const pfx = (a.site_str_pfx || "").trim();
  const name = (a.site_str_name || "").trim();
  const sfx = (a.site_str_sfx || "").trim();
  const dir = (a.site_str_sfx_dir || "").trim();
  const parts = [num, pfx, name, sfx, dir].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim() || "Parcel address TBD";
}

function fbcadAddress(a) {
  if (a.Situs && String(a.Situs).trim()) {
    return String(a.Situs).split(",")[0].trim();
  }
  const parts = [
    a.SitusStreetNumber,
    a.SitusPRDIR,
    a.SitusStreetName,
    a.SitusStreetType,
    a.SitusPODIR,
  ]
    .filter((x) => x != null && String(x).trim())
    .map((x) => String(x).trim());
  return parts.join(" ") || "Parcel address TBD";
}

function cityFromSitus(situs, fallback) {
  if (!situs) return fallback;
  const parts = String(situs).split(",");
  if (parts.length >= 2) {
    const city = parts[1].replace(/\s+TX.*$/i, "").trim();
    if (city) return city;
  }
  return fallback;
}

function baseMeta(provider, asOf) {
  return {
    /** Swapable provider channel — free CAD for now; attom later */
    source: "free-cad",
    provider,
    priceLabel: "Assessed / market value (CAD)",
    priceMethod:
      "County appraisal district assessed/market value — not MLS list price",
    sourceAsOf: asOf,
  };
}

function transformHcadHome(f, asOf) {
  const a = f.attributes;
  const c = polygonCentroid(f.geometry);
  if (!c || Math.abs(c.lat) < 1 || Math.abs(c.lng) < 1) return null;
  const price = Number(a.total_market_val) || Number(a.total_appraised_val);
  if (!(price > 0)) return null;
  const acct = String(a.HCAD_NUM || "").trim();
  const addr = hcadAddress(a);
  const city = (a.site_city || "Houston").trim() || "Houston";
  const zip = String(a.site_zip || "").trim().slice(0, 5);
  const acresRaw = Number(a.acreage_1) || Number(a.Acreage);
  return {
    id: `hcad-home-${acct || `${c.lat.toFixed(5)}-${c.lng.toFixed(5)}`}`,
    type: "home",
    title: `${addr} · ${city}`,
    address: addr,
    city,
    county: "Harris",
    state: "TX",
    zip,
    price: moneyRound(price),
    buildingSf: TYPICAL_HOME_SF,
    buildingSfSource: "typical-proxy",
    buildingSfNote: `Living area not on HCAD parcel layer; ${TYPICAL_HOME_SF} sf typical so $/sf screen ≈ value vs ZHVI`,
    acres: acresRaw > 0 ? Number(acresRaw.toFixed(3)) : undefined,
    lat: Number(c.lat.toFixed(6)),
    lng: Number(c.lng.toFixed(6)),
    apn: acct,
    notes: "Public assessor estimate — verify with realtor / MLS. Not list price.",
    ...baseMeta("hcad", asOf || String(a.tax_year || "")),
  };
}

function transformHcadLand(f, asOf) {
  const a = f.attributes;
  const c = polygonCentroid(f.geometry);
  if (!c || Math.abs(c.lat) < 1 || Math.abs(c.lng) < 1) return null;
  const price = Number(a.total_market_val) || Number(a.land_value);
  let acres = Number(a.acreage_1) || Number(a.Acreage);
  if (!(acres > 0) && Number(a.land_sqft) > 0) acres = Number(a.land_sqft) / 43560;
  if (!(price > 0) || !(acres > 0)) return null;
  const acct = String(a.HCAD_NUM || "").trim();
  const addr = hcadAddress(a);
  const city = (a.site_city || "Harris County").trim() || "Harris County";
  return {
    id: `hcad-land-${acct || `${c.lat.toFixed(5)}-${c.lng.toFixed(5)}`}`,
    type: "land",
    title: `${acres.toFixed(2)} ac vacant · ${city}`,
    address: addr,
    city,
    county: "Harris",
    state: "TX",
    zip: String(a.site_zip || "").trim().slice(0, 5),
    price: moneyRound(price),
    acres: Number(acres.toFixed(3)),
    lat: Number(c.lat.toFixed(6)),
    lng: Number(c.lng.toFixed(6)),
    apn: acct,
    notes: "Vacant (state class C*) public assessor parcel — not MLS ask",
    ...baseMeta("hcad", asOf || String(a.tax_year || "")),
  };
}

function transformFbcadHome(f, asOf) {
  const a = f.attributes;
  const c = polygonCentroid(f.geometry);
  if (!c || Math.abs(c.lat) < 1 || Math.abs(c.lng) < 1) return null;
  const price = Number(a.TotalValue);
  const buildingSf = Number(a.TotalLivingAreaSqFT);
  if (!(price > 0) || !(buildingSf > 0)) return null;
  const pn = String(a.PropertyNumber || a.CADReferenceNumber || "").trim();
  const addr = fbcadAddress(a);
  const city =
    cityFromSitus(a.Situs, null) ||
    (a.OwnerCity || "Fort Bend").toString().trim() ||
    "Fort Bend";
  const zip = String(a.OwnerZip || "").replace(/\D/g, "").slice(0, 5);
  return {
    id: `fbcad-home-${pn || `${c.lat.toFixed(5)}-${c.lng.toFixed(5)}`}`,
    type: "home",
    title: `${addr} · ${city}`,
    address: addr,
    city,
    county: "Fort Bend",
    state: "TX",
    zip,
    price: moneyRound(price),
    buildingSf: Math.round(buildingSf),
    buildingSfSource: "cad",
    acres:
      Number(a.LandSizeAC) > 0
        ? Number(Number(a.LandSizeAC).toFixed(3))
        : undefined,
    lat: Number(c.lat.toFixed(6)),
    lng: Number(c.lng.toFixed(6)),
    apn: pn,
    notes: a.YearBuilt
      ? `Year built ${a.YearBuilt} (CAD assessed value, not list price)`
      : "CAD assessed value — not MLS list price",
    ...baseMeta("fbcad", asOf),
  };
}

function transformFbcadLand(f, asOf) {
  const a = f.attributes;
  const c = polygonCentroid(f.geometry);
  if (!c || Math.abs(c.lat) < 1 || Math.abs(c.lng) < 1) return null;
  const price = Number(a.TotalValue) || Number(a.LandValue);
  const acres = Number(a.LandSizeAC);
  if (!(price > 0) || !(acres > 0)) return null;
  const pn = String(a.PropertyNumber || a.CADReferenceNumber || "").trim();
  const addr = fbcadAddress(a);
  const city =
    cityFromSitus(a.Situs, null) ||
    (a.OwnerCity || "Fort Bend").toString().trim() ||
    "Fort Bend";
  return {
    id: `fbcad-land-${pn || `${c.lat.toFixed(5)}-${c.lng.toFixed(5)}`}`,
    type: "land",
    title: `${acres.toFixed(2)} ac vacant · ${city}`,
    address: addr,
    city,
    county: "Fort Bend",
    state: "TX",
    zip: String(a.OwnerZip || "").replace(/\D/g, "").slice(0, 5),
    price: moneyRound(price),
    acres: Number(acres.toFixed(3)),
    lat: Number(c.lat.toFixed(6)),
    lng: Number(c.lng.toFixed(6)),
    apn: pn,
    notes: "Vacant (LandStateCode C*) CAD parcel — assessed ≠ list price",
    ...baseMeta("fbcad", asOf),
  };
}

function applyLandMedians(zhviSnapshot, listings) {
  const byCounty = new Map();
  for (const l of listings) {
    if (l.type !== "land" || !(l.acres > 0) || !(l.price > 0)) continue;
    // Drop tiny freights / huge ranches that distort county assessor medians
    if (l.acres < 0.15 || l.acres > 40) continue;
    const per = l.price / l.acres;
    // Assessed ag / exemption noise — keep plausible urban-fringe band
    if (!(per >= 8000 && per <= 750000)) continue;
    if (!byCounty.has(l.county)) byCounty.set(l.county, []);
    byCounty.get(l.county).push(per);
  }
  for (const c of zhviSnapshot.counties) {
    const proxy = LAND_PROXY_PER_ACRE[c.county] ?? c.avgLandPerAcre;
    const vals = byCounty.get(c.county);
    if (vals && vals.length >= 5) {
      const m = median(vals);
      if (m && m > 0) {
        // If CAD median is wildly below metro proxy (common for ag-productivity
        // assessed values), blend toward proxy so hurdles stay meaningful.
        let used = m;
        let note = `Median assessed $/acre from ${vals.length} vacant CAD parcels (0.15–40 ac, filtered outliers). Not sales comps.`;
        if (proxy > 0 && m < proxy * 0.25) {
          used = m * 0.35 + proxy * 0.65;
          note = `Blended CAD vacant median ($${moneyRound(m)}/ac, n=${vals.length}) with Houston-metro proxy ($${moneyRound(proxy)}/ac); CAD alone is often productivity/low-use assessed.`;
        }
        c.avgLandPerAcre = moneyRound(used);
        c.landSource =
          proxy > 0 && m < proxy * 0.25
            ? "cad_median_blended_proxy"
            : "cad_parcel_median";
        c.landSampleSize = vals.length;
        c.landNote = note;
      }
    }
  }
}

async function main() {
  ensureDirs();
  const started = Date.now();
  console.log("Estate free data pull — Houston metro (open CAD + ZHVI + FHFA)\n");

  const zhvi = await pullZhvi();

  let fhfa = null;
  if (!skipHpi) {
    try {
      fhfa = await pullFhfaHpi();
    } catch (e) {
      console.warn("[fhfa] failed:", e.message || e);
    }
  }

  const budget = {
    hcadHome: 90,
    hcadLand: 55,
    fbcadHome: 55,
    fbcadLand: 30,
  };

  let hcad = { homes: [], land: [] };
  let fbcad = { homes: [], land: [] };
  const errors = [];

  if (!skipParcels) {
    try {
      hcad = await pullHcadListings(budget.hcadHome, budget.hcadLand);
    } catch (e) {
      errors.push(`HCAD: ${e.message || e}`);
      console.warn("[hcad] failed:", e.message || e);
    }

    try {
      fbcad = await pullFbcadListings(budget.fbcadHome, budget.fbcadLand);
    } catch (e) {
      errors.push(`FBCAD: ${e.message || e}`);
      console.warn("[fbcad] failed:", e.message || e);
    }
  } else {
    console.log("[parcels] skipped (--skip-parcels)");
  }

  const taxYear =
    hcad.homes[0]?.attributes?.tax_year ||
    hcad.land[0]?.attributes?.tax_year ||
    new Date().getFullYear().toString();

  const cadAsOf = String(taxYear);

  const hcadHomes = diversify(
    hcad.homes,
    budget.hcadHome,
    (f) => Number(f.attributes.total_market_val) || 0,
  )
    .map((f) => transformHcadHome(f, taxYear))
    .filter(Boolean);

  const hcadLand = diversify(
    hcad.land,
    budget.hcadLand,
    (f) => Number(f.attributes.total_market_val) || 0,
  )
    .map((f) => transformHcadLand(f, taxYear))
    .filter(Boolean);

  const fbcadHomes = diversify(
    fbcad.homes,
    budget.fbcadHome,
    (f) => Number(f.attributes.TotalValue) || 0,
  )
    .map((f) => transformFbcadHome(f, cadAsOf))
    .filter(Boolean);

  const fbcadLand = diversify(
    fbcad.land,
    budget.fbcadLand,
    (f) => Number(f.attributes.TotalValue) || 0,
  )
    .map((f) => transformFbcadLand(f, cadAsOf))
    .filter(Boolean);

  let listings = [...hcadHomes, ...fbcadHomes, ...hcadLand, ...fbcadLand];
  listings = [...new Map(listings.map((l) => [l.id, l])).values()];

  if (listings.length > MAX_LISTINGS) {
    listings.sort((a, b) => a.price - b.price);
    const cells = new Map();
    const kept = [];
    for (const l of listings) {
      const key = `${l.county}:${(l.lat / 0.05).toFixed(0)}:${(l.lng / 0.05).toFixed(0)}:${l.type}`;
      const n = cells.get(key) || 0;
      if (n >= 3) continue;
      cells.set(key, n + 1);
      kept.push(l);
      if (kept.length >= MAX_LISTINGS) break;
    }
    listings = kept;
  }

  applyLandMedians(zhvi, listings);

  const byProvider = listings.reduce((acc, l) => {
    const p = l.provider || "unknown";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const areaCompsLive = {
    provider: "zhvi+cad",
    source: zhvi.source,
    sourceUrl: zhvi.sourceUrl,
    researchPage: zhvi.researchPage,
    asOf: zhvi.asOf,
    pulledAt: zhvi.pulledAt,
    method: zhvi.method,
    typicalHomeSf: TYPICAL_HOME_SF,
    landMethod:
      "Prefer median assessed $/acre from vacant CAD parcels in sample; else static Houston-metro proxy. Not sales comps.",
    homeDealThreshold: 0.5,
    disclaimer:
      "Home $/sf from public ZHVI research (not MLS). Land $/acre from CAD sample or proxies. Assessor values ≠ list prices. Not ATTOM.",
    counties: zhvi.counties.map((c) => ({
      county: c.county,
      state: c.state,
      medianHomePsf: c.medianHomePsf,
      avgLandPerAcre: c.avgLandPerAcre,
      metro: "Houston",
      zhvi: c.zhvi,
      landSource: c.landSource,
      landSampleSize: c.landSampleSize,
      landNote: c.landNote,
      homeSource: c.homeSource,
      homeNote: c.homeNote,
    })),
    fhfa: fhfa?.metros?.[0]
      ? {
          placeName: fhfa.metros[0].placeName,
          yoyPct: fhfa.metros[0].yoyPct,
          latest: fhfa.metros[0].latest,
        }
      : null,
  };

  const freeLeads = {
    provider: "free-cad",
    /** Future: 'attom' when paid feed is plugged in */
    sourceChannel: "free-cad",
    disclaimer:
      "Public CAD assessed / market estimates, not live MLS list prices. Screen candidates; verify with realtor. Not ATTOM data.",
    sources: [
      {
        id: "zhvi",
        provider: "zhvi",
        name: "Zillow Research ZHVI (county)",
        asOf: zhvi.asOf,
        pulledAt: zhvi.pulledAt,
        url: zhvi.sourceUrl,
      },
      {
        id: "hcad",
        provider: "hcad",
        name: "Harris County Appraisal District parcels (ArcGIS)",
        asOf: cadAsOf,
        url: "https://www.gis.hctx.net/",
      },
      {
        id: "fbcad",
        provider: "fbcad",
        name: "Fort Bend CAD parcels (ArcGIS)",
        asOf: cadAsOf,
        url: "https://gisportal.fortbendcountytx.gov/",
      },
      ...(fhfa
        ? [
            {
              id: "fhfa",
              provider: "fhfa",
              name: "FHFA House Price Index",
              asOf: fhfa.metros?.[0]?.latest
                ? `${fhfa.metros[0].latest.year}-Q${fhfa.metros[0].latest.period}`
                : fhfa.pulledAt,
              url: "https://www.fhfa.gov/data/hpi",
            },
          ]
        : []),
    ],
    pulledAt: new Date().toISOString(),
    asOf: cadAsOf,
    count: listings.length,
    byProvider,
    byType: {
      home: listings.filter((l) => l.type === "home").length,
      land: listings.filter((l) => l.type === "land").length,
    },
    errors,
    listings,
  };

  writeJson(join(GENERATED, "area-comps-live.json"), areaCompsLive);
  writeJson(join(GENERATED, "free-leads.json"), freeLeads);
  writeJson(join(CACHE, "zhvi-counties.json"), areaCompsLive);
  writeJson(join(CACHE, "free-leads.json"), freeLeads);
  writeJson(join(CACHE, "area-comps-live.json"), areaCompsLive);

  writeFileSync(
    join(ROOT, "data", "cache", "README.md"),
    `# Free open-data cache — Houston metro

Generated by \`npm run data:pull\` (\`scripts/data/pull-market-data.mjs\`).

| File | Source | Purpose |
|------|--------|---------|
| \`free-leads.json\` | HCAD + FBCAD ArcGIS | Deal Finder inventory (assessor values) |
| \`area-comps-live.json\` / \`zhvi-counties.json\` | ZHVI + CAD land medians | County $/sf and $/acre benchmarks |
| \`fhfa-hpi.json\` | FHFA HPI | Houston metro price-trend signal |

Also mirrored to \`src/data/generated/*.json\` for **static client import** (no \`fs\` in the browser; Vercel ships the snapshot).

## Important: assessor ≠ list price

- CAD rows use county **assessed / market** values from open ArcGIS, **not** MLS asking prices.
- Home unit price for Harris often uses a typical living-area proxy when CAD omits sqft.
- ZHVI is Zillow Research open data (home value index), not scraped listings.
- This is **not ATTOM** or any paid listing API — sources are swappable later (\`source: free-cad | user | attom\`).

## Re-pull

\`\`\`bash
npm run data:pull
\`\`\`

Options: \`--skip-parcels\`, \`--skip-hpi\`.

**Coverage:** Harris + Fort Bend parcels sample; ZHVI for all six Houston-metro counties in the app.
`,
  );

  writeFileSync(
    join(ROOT, "data", "README.md"),
    `# Market data

Run \`npm run data:pull\` to refresh free public data. See \`cache/README.md\`.
`,
  );

  console.log(
    `\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s — ${listings.length} free-cad listings (${JSON.stringify(byProvider)}), ZHVI asOf ${zhvi.asOf}`,
  );
  console.log("  → src/data/generated/free-leads.json");
  console.log("  → src/data/generated/area-comps-live.json");
  if (errors.length) console.log("Partial errors:", errors.join("; "));
  if (!listings.length && !skipParcels) {
    console.warn(
      "WARNING: zero listings pulled. App falls back to sample inventory until network succeeds.",
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
