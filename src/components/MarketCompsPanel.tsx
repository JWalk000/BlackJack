"use client";

import { useEffect, useMemo, useState } from "react";
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

function propertyLocationLine(deal: Deal): string {
  const p = deal.property;
  return [
    p.address?.trim(),
    [p.city?.trim(), p.state?.trim(), p.zip?.trim()].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Area comps from Property tab. Free ZHVI zip/county first;
 * optional RentCast via API when key set and free miss.
 */
export function MarketCompsPanel({ deal }: { deal: Deal }) {
  const p = deal.property;
  const location = propertyLocationLine(deal);
  const hasLocation = Boolean(
    p.address?.trim() || p.city?.trim() || p.zip?.trim(),
  );

  const localSnap = useMemo(
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

  const [snap, setSnap] = useState<MarketCompsSnapshot | null>(localSnap);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSnap(localSnap);
    if (localSnap || !hasLocation) return;

    const ac = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (p.city) params.set("city", p.city);
    if (p.state) params.set("state", p.state);
    if (p.zip) params.set("zip", p.zip);
    if (p.address) params.set("address", p.address);
    if (p.buildingSf != null) params.set("buildingSf", String(p.buildingSf));
    if (deal.assumptions.arv != null) {
      params.set("arv", String(deal.assumptions.arv));
    }
    void fetch(`/api/property/market?${params}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: { snapshot?: MarketCompsSnapshot | null }) => {
        if (!ac.signal.aborted && data.snapshot) setSnap(data.snapshot);
      })
      .catch(() => {
        /* keep null */
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [
    localSnap,
    hasLocation,
    p.city,
    p.state,
    p.zip,
    p.address,
    p.buildingSf,
    deal.assumptions.arv,
  ]);

  if (!hasLocation) {
    return (
      <section className="panel space-y-3 p-5 sm:p-6">
        <p className="page-label">Market</p>
        <h2 className="font-display text-xl tracking-tight text-ink">
          Area comps snapshot
        </h2>
        <p className="text-sm text-muted">
          Fill the address (or city / state / zip) on the{" "}
          <strong className="font-medium text-ink">Property</strong> tab. This
          panel pulls from those fields automatically.
        </p>
      </section>
    );
  }

  if (!snap) {
    return (
      <section className="panel space-y-4 p-5 sm:p-6">
        <div>
          <p className="page-label">Market</p>
          <h2 className="mt-1 font-display text-xl tracking-tight text-ink sm:text-2xl">
            Area comps snapshot
          </h2>
          <p className="mt-1 text-sm text-muted">{location}</p>
        </div>
        <div className="border border-line bg-sand/40 px-4 py-3 text-sm leading-relaxed text-muted">
          <p className="font-medium text-ink">Location taken from Property</p>
          {loading ? (
            <p className="mt-2">Looking up free ZIP / county benchmarks…</p>
          ) : (
            <>
              <p className="mt-2">
                No free ZHVI index for this ZIP yet. Run{" "}
                <code className="text-ink">npm run data:pull</code>, or set{" "}
                <code className="text-ink">RENTCAST_API_KEY</code> for paid ZIP
                market stats.
              </p>
              <p className="mt-2">
                Building SF:{" "}
                {p.buildingSf != null ? p.buildingSf.toLocaleString() : "—"}
                {" · "}Tax assessment:{" "}
                {p.taxAssessment != null ? money(p.taxAssessment) : "—"}
                {" · "}Year built: {p.yearBuilt != null ? p.yearBuilt : "—"}
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  const band = bandForSf(snap, p.buildingSf);
  const geo =
    snap.geographyLabel ||
    [
      snap.county && !/^\d{5}$/.test(snap.county)
        ? `${snap.county} County`
        : snap.zip
          ? `ZIP ${snap.zip}`
          : snap.county,
      snap.state,
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-label">Market</p>
          <h2 className="mt-1 font-display text-xl tracking-tight text-ink sm:text-2xl">
            Area comps snapshot
          </h2>
          <p className="mt-1 text-sm text-muted">{location}</p>
          <p className="mt-0.5 text-xs text-muted">
            Benchmarks: {geo}
            {snap.metro ? ` · ${snap.metro}` : ""}
            {snap.asOf && snap.asOf !== "—" ? ` · as of ${snap.asOf}` : ""}
            {snap.provider ? ` · ${snap.provider}` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
        <div className="bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Median home $/sf
          </p>
          <p className="mt-1 font-display text-2xl text-ink">
            ${Math.round(snap.medianHomePsf).toLocaleString()}
          </p>
          {snap.homeSource ? (
            <p className="mt-1 text-[11px] text-muted">{snap.homeSource}</p>
          ) : null}
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Area home value (typical)
          </p>
          <p className="mt-1 font-display text-2xl text-ink">
            {snap.impliedMedianHome ? money(snap.impliedMedianHome) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Index / market median home value
          </p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Avg land $/acre
          </p>
          <p className="mt-1 font-display text-2xl text-ink">
            {snap.avgLandPerAcre > 0 ? money(snap.avgLandPerAcre) : "—"}
          </p>
          {snap.avgLandPerAcre <= 0 ? (
            <p className="mt-1 text-[11px] text-muted">
              Houston free CAD only
            </p>
          ) : snap.fhfaYoyPct != null ? (
            <p className="mt-1 text-[11px] text-muted">
              FHFA metro YoY {snap.fhfaYoyPct > 0 ? "+" : ""}
              {snap.fhfaYoyPct.toFixed(1)}%
            </p>
          ) : null}
        </div>
      </div>

      {band ? (
        <div className="border border-line bg-sand/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Your building SF × area band
          </p>
          <p className="mt-1 font-display text-lg text-ink">
            {money(band.low)} – {money(band.high)}
            <span className="ml-2 text-sm font-normal text-muted">
              mid {money(band.mid)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Based on {p.buildingSf!.toLocaleString()} sf at ~85–115% of area
            median $/sf. Reality check for ARV — not a CMA.
          </p>
          {snap.dealPsf != null && snap.vsMedianPct != null ? (
            <p className="mt-2 text-sm text-ink">
              Your ARV is{" "}
              <strong>${Math.round(snap.dealPsf).toLocaleString()}/sf</strong> (
              {snap.vsMedianPct >= 0 ? "+" : ""}
              {snap.vsMedianPct.toFixed(0)}% vs median)
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Set building square feet (and ARV) on Property / Final numbers to
          compare against area median $/sf.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-muted">{snap.disclaimer}</p>
    </section>
  );
}
