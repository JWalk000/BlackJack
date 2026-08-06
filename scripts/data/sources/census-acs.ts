/**
 * Census ACS 5-year — free with API key from https://api.census.gov/data/key_signup.html
 * Without CENSUS_API_KEY this module is skipped.
 *
 * Variables:
 *   B25077_001E median home value
 *   B25064_001E median gross rent
 *   B25001_001E housing units
 */
import { fetchJson, writeJson } from "../lib/io";

const ACS_YEAR = "2023";

/** Counties in Estate MSAs (state + county FIPS) */
const COUNTIES: {
  marketId: "houston" | "virginia";
  state: string;
  county: string;
  name: string;
}[] = [
  { marketId: "houston", state: "48", county: "201", name: "Harris County, TX" },
  { marketId: "houston", state: "48", county: "157", name: "Fort Bend County, TX" },
  { marketId: "houston", state: "48", county: "339", name: "Montgomery County, TX" },
  { marketId: "houston", state: "48", county: "039", name: "Brazoria County, TX" },
  { marketId: "houston", state: "48", county: "167", name: "Galveston County, TX" },
  { marketId: "virginia", state: "51", county: "013", name: "Arlington County, VA" },
  { marketId: "virginia", state: "51", county: "059", name: "Fairfax County, VA" },
  { marketId: "virginia", state: "51", county: "107", name: "Loudoun County, VA" },
  { marketId: "virginia", state: "51", county: "153", name: "Prince William County, VA" },
  { marketId: "virginia", state: "51", county: "179", name: "Stafford County, VA" },
  { marketId: "virginia", state: "51", county: "087", name: "Henrico County, VA" },
  { marketId: "virginia", state: "51", county: "041", name: "Chesterfield County, VA" },
  { marketId: "virginia", state: "51", county: "760", name: "Richmond city, VA" },
];

export type AcsCounty = {
  marketId: "houston" | "virginia";
  name: string;
  stateFips: string;
  countyFips: string;
  medianHomeValue: number | null;
  medianGrossRent: number | null;
  housingUnits: number | null;
};

export async function pullCensusAcs(
  apiKey: string | undefined,
): Promise<AcsCounty[] | null> {
  if (!apiKey) {
    console.log(
      "[census] skipped — set CENSUS_API_KEY for free ACS housing stats (api.census.gov/data/key_signup.html)",
    );
    return null;
  }

  // Houston-only free ACS pull (surrounding counties within ~100 mi)
  const houstonCounties = COUNTIES.filter((c) => c.marketId === "houston");
  if (!houstonCounties.length) return null;

  console.log(
    `[census] ACS ${ACS_YEAR} 5-year for ${houstonCounties.length} Houston-area counties…`,
  );

  const byState = new Map<string, typeof houstonCounties>();
  for (const c of houstonCounties) {
    const list = byState.get(c.state) ?? [];
    list.push(c);
    byState.set(c.state, list);
  }

  const out: AcsCounty[] = [];

  for (const [state, counties] of byState) {
    const countyList = counties.map((c) => c.county).join(",");
    const url =
      `https://api.census.gov/data/${ACS_YEAR}/acs/acs5` +
      `?get=NAME,B25077_001E,B25064_001E,B25001_001E` +
      `&for=county:${countyList}&in=state:${state}&key=${apiKey}`;

    const rows = await fetchJson<(string | null)[][]>(url, {
      timeoutMs: 45_000,
    });
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const [name, medValue, medRent, units, st, cty] = row;
      const meta = counties.find((c) => c.county === cty);
      out.push({
        marketId: "houston",
        name: name ?? meta?.name ?? `${st}-${cty}`,
        stateFips: st ?? state,
        countyFips: cty ?? "",
        medianHomeValue:
          medValue && medValue !== "-666666666" ? Number(medValue) : null,
        medianGrossRent:
          medRent && medRent !== "-666666666" ? Number(medRent) : null,
        housingUnits:
          units && units !== "-666666666" ? Number(units) : null,
      });
    }
  }

  writeJson("census-acs.json", {
    source: `Census ACS ${ACS_YEAR} 5-year`,
    market: "houston",
    real: true,
    license: "U.S. Census Bureau public data",
    pulledAt: new Date().toISOString(),
    counties: out,
  });
  console.log(`[census] wrote ${out.length} Houston-area counties`);
  return out;
}
