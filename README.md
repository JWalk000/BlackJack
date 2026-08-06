# Estate

Build and underwrite real estate deals — ground-up or rehab, residential or commercial — with full itemized costs.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Deals save in your browser (localStorage) until a backend is added.

## Find deals (public market data)

**Route:** `/deals/find`

Inventory and benchmarks ship as committed JSON snapshots under `src/data/generated/` (static import — no `fs` in the client). Production does not scrape at request time.

| Source | Use |
|--------|-----|
| [Zillow Research ZHVI](https://www.zillow.com/research/data/) county CSV | Area median home $/sf ≈ ZHVI ÷ 1900 finished sf |
| Harris CAD parcels (ArcGIS) | Residential + vacant parcel sample (assessed/market value) |
| Fort Bend CAD parcels (ArcGIS) | Homes with living area + vacant land |
| [FHFA HPI](https://www.fhfa.gov/data/hpi) (optional) | Houston metro trend badge only |

**CAD assessed/market value ≠ MLS list price.** UI labels price as assessor value and asks users to verify with a realtor.

### Refresh data

```bash
npm run data:pull
```

Writes:

- `src/data/generated/free-leads.json`
- `src/data/generated/area-comps-live.json`
- `data/cache/*` mirrors

Options: `--skip-parcels`, `--skip-hpi`. Redeploy after pull to publish new snapshots.
