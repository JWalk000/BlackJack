/**
 * FHFA House Price Index — free public CSV, no API key.
 * https://www.fhfa.gov/data/hpi
 */
import { fetchText, writeJson } from "../lib/io";

const FHFA_MASTER =
  "https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv";

/** Metros covering Estate markets */
export const TARGET_MSAS = [
  {
    marketId: "houston" as const,
    placeId: "26420",
    match: /Houston-Pasadena-The Woodlands/i,
    label: "Houston-Pasadena-The Woodlands, TX",
  },
  {
    marketId: "virginia" as const,
    placeId: "47764",
    match: /Washington,\s*DC-MD/i,
    label: "Washington, DC-MD (MSAD)",
  },
  {
    marketId: "virginia" as const,
    placeId: "40060",
    match: /^"?Richmond, VA"?$/i,
    label: "Richmond, VA",
  },
];

export type HpiPoint = {
  year: number;
  period: number; // quarter 1–4 or month
  index: number;
};

export type MetroHpi = {
  marketId: "houston" | "virginia";
  placeId: string;
  placeName: string;
  frequency: string;
  flavor: string;
  series: HpiPoint[];
  latest: HpiPoint | null;
  priorYear: HpiPoint | null;
  yoyPct: number | null;
  fiveYearPct: number | null;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function computeChange(curr: number, base: number): number {
  return ((curr - base) / base) * 100;
}

export async function pullFhfaHpi(): Promise<MetroHpi[]> {
  console.log("[fhfa] downloading hpi_master.csv…");
  const csv = await fetchText(FHFA_MASTER, { timeoutMs: 120_000 });
  const lines = csv.split(/\r?\n/);
  const header = parseCsvLine(lines[0] ?? "");
  const idx = (name: string) => header.indexOf(name);

  const iType = idx("hpi_type");
  const iFlavor = idx("hpi_flavor");
  const iFreq = idx("frequency");
  const iLevel = idx("level");
  const iName = idx("place_name");
  const iId = idx("place_id");
  const iYr = idx("yr");
  const iPer = idx("period");
  const iIdx = idx("index_nsa");

  type Bucket = {
    meta: (typeof TARGET_MSAS)[number];
    placeName: string;
    series: HpiPoint[];
  };
  const buckets = new Map<string, Bucket>();

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (cols[iLevel] !== "MSA") continue;
    if (cols[iType] !== "traditional") continue;
    // all-transactions quarterly is the broadest free public series
    if (cols[iFlavor] !== "all-transactions") continue;
    if (cols[iFreq] !== "quarterly") continue;

    const placeName = cols[iName]?.replace(/^"|"$/g, "") ?? "";
    const placeId = cols[iId] ?? "";
    const match = TARGET_MSAS.find(
      (t) => t.placeId === placeId || t.match.test(placeName),
    );
    if (!match) continue;

    const year = Number(cols[iYr]);
    const period = Number(cols[iPer]);
    const index = Number(cols[iIdx]);
    if (!year || !period || !index || Number.isNaN(index)) continue;

    const key = match.placeId;
    let b = buckets.get(key);
    if (!b) {
      b = { meta: match, placeName, series: [] };
      buckets.set(key, b);
    }
    b.series.push({ year, period, index });
  }

  const results: MetroHpi[] = [];

  for (const b of buckets.values()) {
    b.series.sort((a, c) => a.year - c.year || a.period - c.period);
    const latest = b.series[b.series.length - 1] ?? null;
    const priorYear =
      latest == null
        ? null
        : b.series.find(
            (p) => p.year === latest.year - 1 && p.period === latest.period,
          ) ?? null;
    const fiveYear =
      latest == null
        ? null
        : b.series.find(
            (p) => p.year === latest.year - 5 && p.period === latest.period,
          ) ?? null;

    results.push({
      marketId: b.meta.marketId,
      placeId: b.meta.placeId,
      placeName: b.placeName || b.meta.label,
      frequency: "quarterly",
      flavor: "all-transactions",
      series: b.series.slice(-20), // keep last 5 years for charts
      latest,
      priorYear: priorYear ?? null,
      yoyPct:
        latest && priorYear
          ? Math.round(computeChange(latest.index, priorYear.index) * 10) / 10
          : null,
      fiveYearPct:
        latest && fiveYear
          ? Math.round(computeChange(latest.index, fiveYear.index) * 10) / 10
          : null,
    });
  }

  const payload = {
    source: "FHFA HPI (hpi_master.csv)",
    license: "Public domain / FHFA official release",
    pulledAt: new Date().toISOString(),
    metros: results,
  };

  writeJson("fhfa-hpi.json", payload);
  console.log(`[fhfa] wrote ${results.length} metro series → data/cache/fhfa-hpi.json`);
  return results;
}
