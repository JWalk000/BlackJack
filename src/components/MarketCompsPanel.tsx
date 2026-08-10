"use client";

import { useMemo } from "react";
import type { Deal } from "@/lib/types";
import { money } from "@/lib/underwriting";
import {
  resolveMarketComps,
  type MarketCompsSnapshot,
} from "@/lib/property-lookup";

function bandForSf(snapshot: MarketCompsSnapshot, buildingSf: number | null) {
  if (!(buildingSf && buildingSf > 0 && snapshot.medianHomePsf > 0)) {
    return null;
  }
  const mid = Math.round(snapshot.medianHomePsf * buildingSf);
  return {
    low: Math.round(mid * 0.85),
    mid,
    high: Math.round(mid * 1.15),
  };
}

/**
 * Final numbers: free area comps (ZIP ZHVI / county medians).
 */
export function MarketCompsPanel({ deal }: { deal: Deal }) {
  const p = deal.property;
  const snap = useMemo(
    () =>
      resolveMarketComps({
        city: p.city,
        state: p.state || "TX",
        zip: p.zip,
        buildingSf: p.buildingSf,
        arv: deal.assumptions.arv,
      }),
    [p.city, p.state, p.zip, p.buildingSf, deal.assumptions.arv],
  );

  if (!snap) {
    return (
      <section className="panel space-y-2 p-3 sm:p-4">
        <p className="page-label">Market</p>
        <h2 className="font-display text-lg tracking-tight text-ink">
          Area comps snapshot
        </h2>
        <p className="text-sm text-muted">
          Add a city or ZIP on the Property tab (or use address lookup) to load
          free area $/sf benchmarks. Not MLS comps.
        </p>
      </section>
    );
  }

  const band = bandForSf(snap, p.buildingSf);
  const geo =
    snap.geographyLabel ||
    `${snap.county} County, ${snap.state}${snap.zip ? ` · ${snap.zip}` : ""}`;

  return (
    <section className="panel space-y-2 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div>
          <p className="page-label">Market</p>
          <h2 className="mt-0.5 font-display text-lg tracking-tight text-ink sm:text-xl">
            Area comps snapshot
          </h2>
        </div>
        <p className="text-xs text-muted">
          {geo}
          {snap.metro ? ` · ${snap.metro}` : ""}
          {snap.asOf && snap.asOf !== "—" ? ` · as of ${snap.asOf}` : ""}
        </p>
      </div>

      <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
        <div className="bg-surface px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Median home $/sf
          </p>
          <p className="mt-0.5 font-display text-xl text-ink">
            ${Math.round(snap.medianHomePsf).toLocaleString()}
          </p>
          {snap.homeSource ? (
            <p className="mt-0.5 text-[11px] text-muted">{snap.homeSource}</p>
          ) : null}
        </div>
        <div className="bg-surface px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Area home value (typ.)
          </p>
          <p className="mt-0.5 font-display text-xl text-ink">
            {snap.impliedMedianHome
              ? money(snap.impliedMedianHome)
              : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            Index × typical size or ZIP ZHVI
          </p>
        </div>
        <div className="bg-surface px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Avg land $/acre
          </p>
          <p className="mt-0.5 font-display text-xl text-ink">
            {snap.avgLandPerAcre > 0 ? money(snap.avgLandPerAcre) : "—"}
          </p>
          {snap.fhfaYoyPct != null ? (
            <p className="mt-0.5 text-[11px] text-muted">
              FHFA metro YoY {snap.fhfaYoyPct > 0 ? "+" : ""}
              {snap.fhfaYoyPct.toFixed(1)}%
            </p>
          ) : null}
        </div>
      </div>

      {band ? (
        <div className="border border-line bg-sand/40 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Your building SF × area band
          </p>
          <p className="mt-0.5 font-display text-base text-ink">
            {money(band.low)} – {money(band.high)}
            <span className="ml-2 text-sm font-normal text-muted">
              mid {money(band.mid)}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {p.buildingSf!.toLocaleString()} sf at ~85–115% of area median
            $/sf. ARV sanity check — not a CMA.
          </p>
          {snap.dealPsf != null && snap.vsMedianPct != null ? (
            <p className="mt-1 text-sm text-ink">
              Your ARV is{" "}
              <strong>${Math.round(snap.dealPsf).toLocaleString()}/sf</strong> (
              {snap.vsMedianPct >= 0 ? "+" : ""}
              {snap.vsMedianPct.toFixed(0)}% vs median)
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Enter building square feet (and ARV) for an implied value band.
        </p>
      )}

      <p className="text-[11px] leading-snug text-muted">{snap.disclaimer}</p>
    </section>
  );
}
