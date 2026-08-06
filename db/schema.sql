-- Estate parcel data layer
-- Target markets: Houston (+100 mi) and Northern VA → Richmond
-- Run: psql $DATABASE_URL -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- Markets & exit comps (refreshed from free CSVs later)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY, -- 'houston' | 'virginia'
  label TEXT NOT NULL,
  anchor TEXT NOT NULL,
  radius_note TEXT,
  as_of TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submarkets (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  miles_from_anchor NUMERIC NOT NULL,
  sale_psf NUMERIC NOT NULL,
  typical_unit_sf NUMERIC NOT NULL,
  land_psf NUMERIC NOT NULL,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS build_costs (
  id TEXT PRIMARY KEY, -- market_id + product_type
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL,
  label TEXT NOT NULL,
  hard_cost_psf NUMERIC NOT NULL,
  soft_pct NUMERIC NOT NULL,
  contingency_pct NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (market_id, product_type)
);

-- -------------------------------------------------------
-- Parcels: your owned copy of county assessor data
-- Ingest monthly; app only queries this table.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL REFERENCES markets(id),
  submarket_id TEXT REFERENCES submarkets(id),
  source TEXT NOT NULL, -- e.g. 'hcad', 'fbcad', 'fairfax', 'manual_sample'
  apn TEXT NOT NULL,
  address TEXT,
  city TEXT,
  county TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  acres NUMERIC,
  lot_sf NUMERIC,
  land_value NUMERIC,
  improvement_value NUMERIC,
  total_assessed NUMERIC,
  year_built INT,
  living_sf NUMERIC,
  land_use TEXT,
  owner_name TEXT,
  owner_mailing TEXT,
  owner_city TEXT,
  owner_state TEXT,
  last_sale_date DATE,
  last_sale_price NUMERIC,
  tax_delinquent BOOLEAN NOT NULL DEFAULT false,
  listed_for_sale BOOLEAN NOT NULL DEFAULT false,
  miles_from_anchor NUMERIC,
  raw JSONB,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, apn)
);

CREATE INDEX IF NOT EXISTS parcels_market_idx ON parcels (market_id);
CREATE INDEX IF NOT EXISTS parcels_county_idx ON parcels (county);
CREATE INDEX IF NOT EXISTS parcels_improvement_ratio_idx
  ON parcels ((CASE WHEN land_value > 0 THEN improvement_value / NULLIF(land_value, 0) ELSE NULL END));

-- Off-market / rebuild candidates derived from parcels
CREATE TABLE IF NOT EXISTS deal_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL REFERENCES markets(id),
  submarket_id TEXT REFERENCES submarkets(id),
  kind TEXT NOT NULL CHECK (kind IN ('vacant_land', 'teardown', 'underimproved')),
  score_hint NUMERIC,
  why_off_market TEXT,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parcel_id, kind)
);

CREATE INDEX IF NOT EXISTS deal_leads_market_active_idx
  ON deal_leads (market_id, active);

-- Ingest run log (so monthly jobs are auditable)
CREATE TABLE IF NOT EXISTS ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  market_id TEXT,
  status TEXT NOT NULL, -- 'ok' | 'error'
  rows_upserted INT NOT NULL DEFAULT 0,
  message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
