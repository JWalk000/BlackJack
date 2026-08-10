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
 * Compact market context for Final numbers (not a third full card stack).
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
      <p className="border border-line bg-paper px-3 py-2 text-xs text-muted">
        <span className="font-semibold uppercase tracking-[0.12em] text-signal">
          Market
        </span>
        {" · "}
        Add city or ZIP on Property for free area $/sf (not MLS).
      </p>
    );
  }

  const band = bandForSf(snap, p.buildingSf);
  const geo =
    snap.geographyLabel ||
    `${snap.county} County, ${snap.state}${snap.zip ? ` · ${snap.zip}` : ""}`;

  return (
    <section className="border border-line bg-paper px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-signal">
          Market · {geo}
          {snap.asOf && snap.asOf !== "—" ? ` · ${snap.asOf}` : ""}
        </p>
      </div>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <p>
          <span className="text-muted">$/sf </span>
          <span className="font-medium text-ink">
            ${Math.round(snap.medianHomePsf).toLocaleString()}
          </span>
        </p>
        <p>
          <span className="text-muted">Typ. home </span>
          <span className="font-medium text-ink">
            {snap.impliedMedianHome ? money(snap.impliedMedianHome) : "—"}
          </span>
        </p>
        <p>
          <span className="text-muted">Land /ac </span>
          <span className="font-medium text-ink">
            {snap.avgLandPerAcre > 0 ? money(snap.avgLandPerAcre) : "—"}
          </span>
        </p>
      </div>
      {band ? (
        <p className="mt-1.5 text-xs text-muted">
          Your SF band {money(band.low)}–{money(band.high)}
          {snap.dealPsf != null && snap.vsMedianPct != null
            ? ` · ARV $${Math.round(snap.dealPsf).toLocaleString()}/sf (${snap.vsMedianPct >= 0 ? "+" : ""}${snap.vsMedianPct.toFixed(0)}% vs median)`
            : null}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">
          Set building SF (and ARV) for a value band check.
        </p>
      )}
    </section>
  );
}
