# Free open-data cache — **Houston metro**

```bash
npm run data:pull
```

| File | Source | Real? | Purpose |
|------|--------|-------|---------|
| `leads-free.json` | HCAD + FBCAD GIS | **Yes** — live county assessed values | Off-market Deal Finder leads |
| `parcels-hcad.json` | Harris CAD MapServer | **Yes** | Raw Harris parcels |
| `parcels-fbcad.json` | Fort Bend public parcels | **Yes** | Sugar Land / Katy SW / Rosenberg area |
| `fhfa-hpi.json` | FHFA House Price Index | **Yes** | Houston (and other metro) price trends |
| `census-acs.json` | Census ACS (optional key) | **Yes** | County median value / rent |

**What “real” means here**

- Parcel rows come from county appraisal districts over free ArcGIS endpoints.
- Land / improvement / market values are **assessor** figures, not list or sale prices.
- Not an MLS feed, not a full county dump — a filtered sample (vacant / teardown / underimproved).
- Geometry centroids are real parcel polygons reprojected to lat/lng.

**Coverage today:** Harris + Fort Bend. Expand later with Montgomery, Brazoria, Galveston CAD GIS the same way.
