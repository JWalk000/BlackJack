"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILD_COSTS,
  PRODUCT_META,
  productsByCategory,
  type MarketId,
  type ProductType,
} from "@/data/markets";
import { coordsForLead, coordsForSubmarket } from "@/data/map-coords";
import {
  OFF_MARKET_LEADS,
  type OffMarketLead,
  type OpportunityKind,
} from "@/data/offmarket-leads";
import { savePendingDeal, type PendingDeal } from "@/lib/deal-project";
import {
  getMarketMeta,
  scoreDeals,
  scoreOffMarketLeads,
  type OffMarketResult,
  type DealResult,
} from "@/lib/deals";
import type { MapPin } from "@/components/DealMap";

const DealMap = dynamic(() => import("@/components/DealMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-limestone text-sm text-steel">
      Loading map…
    </div>
  ),
});

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type ViewMode = "offmarket" | "submarkets";
type DataSource = "sample" | "database" | "open_data" | "loading";

type MarketSignal = {
  placeName: string;
  yoyPct: number | null;
  fiveYearPct: number | null;
  latest: { year: number; period: number } | null;
};

const KIND_OPTIONS: { id: OpportunityKind; label: string }[] = [
  { id: "vacant_land", label: "Vacant land" },
  { id: "teardown", label: "Teardowns" },
  { id: "underimproved", label: "Underimproved" },
];

type LeadSourceLike = "sample" | "database" | "open_data" | string;

function sourceLabel(src: DataSource) {
  if (src === "loading") return "loading…";
  if (src === "database") return "Postgres";
  if (src === "open_data") return "real Houston CAD (HCAD+FBCAD)";
  return "samples";
}

function normalizeSource(src?: LeadSourceLike): DataSource {
  if (src === "database" || src === "open_data" || src === "sample") return src;
  return "sample";
}

export function DealFinder() {
  const router = useRouter();
  const marketId: MarketId = "houston";
  const [view, setView] = useState<ViewMode>("offmarket");
  const [productType, setProductType] = useState<ProductType>("for_sale_sf");
  const [targetMargin, setTargetMargin] = useState(15);
  const [hardOverride, setHardOverride] = useState<string>("");
  const [maxMiles, setMaxMiles] = useState(100);
  const [onlyPasses, setOnlyPasses] = useState(true);
  const [kinds, setKinds] = useState<OpportunityKind[]>([
    "vacant_land",
    "teardown",
    "underimproved",
  ]);
  const [motivatedOnly, setMotivatedOnly] = useState(false);
  const [leadPool, setLeadPool] = useState<OffMarketLead[]>(() =>
    OFF_MARKET_LEADS.filter((l) => l.marketId === "houston"),
  );
  const [dataSource, setDataSource] = useState<DataSource>("loading");
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const listItemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    setDataSource("loading");
    fetch(`/api/deals/leads?market=${marketId}`)
      .then((r) => r.json())
      .then(
        (body: {
          source?: LeadSourceLike;
          leads?: OffMarketLead[];
        }) => {
          if (cancelled) return;
          if (body.leads?.length) {
            setLeadPool(body.leads);
            setDataSource(normalizeSource(body.source));
          } else {
            setLeadPool(
              OFF_MARKET_LEADS.filter((l) => l.marketId === marketId),
            );
            setDataSource("sample");
          }
        },
      )
      .catch(() => {
        if (cancelled) return;
        setLeadPool(OFF_MARKET_LEADS.filter((l) => l.marketId === marketId));
        setDataSource("sample");
      });
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/data/signals?market=${marketId}`)
      .then((r) => r.json())
      .then(
        (body: {
          fhfa?: { metros?: MarketSignal[] } | null;
        }) => {
          if (cancelled) return;
          setSignals(body.fhfa?.metros ?? []);
        },
      )
      .catch(() => {
        if (!cancelled) setSignals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  useEffect(() => {
    setSelectedId(null);
  }, [view, marketId]);

  const meta = getMarketMeta(marketId);
  const grouped = productsByCategory(marketId);
  const defaultHard =
    BUILD_COSTS.find(
      (b) => b.marketId === marketId && b.productType === productType,
    )?.hardCostPsf ?? 0;

  const hardCostOverride = useMemo(() => {
    const override = hardOverride.trim() ? Number(hardOverride) : undefined;
    return override && !Number.isNaN(override) ? override : undefined;
  }, [hardOverride]);

  const baseInputs = {
    marketId,
    productType,
    targetMarginPct: targetMargin,
    hardCostOverride,
    maxMiles,
  };

  const leadResults = useMemo(
    () =>
      scoreOffMarketLeads(
        {
          ...baseInputs,
          kinds,
          requireAbsenteeOrEstate: motivatedOnly,
        },
        leadPool,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      marketId,
      productType,
      targetMargin,
      hardCostOverride,
      maxMiles,
      kinds,
      motivatedOnly,
      leadPool,
    ],
  );

  const subResults = useMemo(
    () => scoreDeals(baseInputs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketId, productType, targetMargin, hardCostOverride, maxMiles],
  );

  const visibleLeads = onlyPasses
    ? leadResults.filter((r) => r.passes)
    : leadResults;
  const visibleSubs = onlyPasses
    ? subResults.filter((r) => r.passes)
    : subResults;

  const selectedLead = useMemo(
    () => visibleLeads.find((r) => r.lead.id === selectedId) ?? null,
    [visibleLeads, selectedId],
  );

  const leadPins: MapPin[] = useMemo(() => {
    const pins: MapPin[] = [];
    for (const r of visibleLeads) {
      const pos = coordsForLead(r.lead);
      if (!pos) continue;
      pins.push({
        id: r.lead.id,
        position: pos,
        title: r.lead.address,
        subtitle: `${r.lead.city} · ${r.kindLabel}`,
        passes: r.passes,
        priceLabel: `${money(r.lead.askingOrAssessed)} site · ${(r.marginPct * 100).toFixed(0)}% margin`,
      });
    }
    return pins;
  }, [visibleLeads]);

  const subPins: MapPin[] = useMemo(() => {
    const pins: MapPin[] = [];
    for (const r of visibleSubs) {
      const pos = coordsForSubmarket(r.submarket.id);
      if (!pos) continue;
      pins.push({
        id: r.submarket.id,
        position: pos,
        title: r.submarket.name,
        subtitle: r.productLabel,
        passes: r.passes,
        priceLabel: `${money(r.salePsf)}/sf exit · ${(r.marginPct * 100).toFixed(0)}%`,
      });
    }
    return pins;
  }, [visibleSubs]);

  const activePins = view === "offmarket" ? leadPins : subPins;

  function selectId(id: string) {
    setSelectedId(id);
    const el = listItemRefs.current[id];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function toggleKind(kind: OpportunityKind) {
    setKinds((prev) =>
      prev.includes(kind)
        ? prev.filter((k) => k !== kind)
        : [...prev, kind],
    );
  }

  function startPlanning(result: OffMarketResult) {
    if (starting) return;
    setStarting(true);
    const pending: PendingDeal = {
      lead: result.lead,
      productType,
      productLabel: result.productLabel,
      marginPct: result.marginPct,
      thesis: result.thesis,
      kindLabel: result.kindLabel,
      salePsf: result.salePsf,
      allInBuildPsf: result.allInBuildPsf,
      targetMarginPct: targetMargin,
    };
    savePendingDeal(pending);
    router.push("/workspace/from-deal");
  }

  const houSignals = signals.filter((s) =>
    /Houston/i.test(s.placeName),
  );
  const signalLine =
    houSignals[0]?.yoyPct != null
      ? `Houston prices ${houSignals[0].yoyPct > 0 ? "+" : ""}${houSignals[0].yoyPct}% YoY (FHFA)`
      : null;

  return (
    <div className="space-y-6">
      {/* Mode + quiet status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "offmarket" as const, label: "Off-market deals" },
              { id: "submarkets" as const, label: "Submarkets" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`px-4 py-2 text-sm transition ${
                view === tab.id
                  ? "bg-ink text-paper"
                  : "border border-line text-steel hover:border-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-steel">
          {signalLine && <span className="text-ink">{signalLine}</span>}
          {signalLine && " · "}
          {sourceLabel(dataSource)}
        </p>
      </div>

      {/* One control strip — Houston only */}
      <div className="border border-line bg-limestone p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="block">
            <span className="text-xs font-medium text-steel">Market</span>
            <div className="mt-1.5 flex h-[42px] items-center border border-line bg-paper px-3 text-sm text-ink">
              Houston
            </div>
          </div>

          <label className="block sm:col-span-1 lg:col-span-1">
            <span className="text-xs font-medium text-steel">
              Build product
            </span>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductType)}
              className="mt-1.5 w-full border border-line bg-paper px-3 py-2.5 text-sm outline-none"
            >
              <optgroup label="Residential">
                {grouped.residential.map((p) => (
                  <option key={p.productType} value={p.productType}>
                    {PRODUCT_META[p.productType].label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Multifamily">
                {grouped.multifamily.map((p) => (
                  <option key={p.productType} value={p.productType}>
                    {PRODUCT_META[p.productType].label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <label className="block">
            <span className="flex justify-between text-xs font-medium text-steel">
              <span>Min. margin</span>
              <span className="font-mono text-ink">{targetMargin}%</span>
            </span>
            <input
              type="range"
              min={8}
              max={30}
              step={1}
              value={targetMargin}
              onChange={(e) => setTargetMargin(Number(e.target.value))}
              className="mt-3 w-full accent-copper"
            />
          </label>

          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={onlyPasses}
                onChange={(e) => setOnlyPasses(e.target.checked)}
                className="accent-copper"
              />
              Passing only
            </label>
            {view === "offmarket" && (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={motivatedOnly}
                  onChange={(e) => setMotivatedOnly(e.target.checked)}
                  className="accent-copper"
                />
                Motivated owners
              </label>
            )}
          </div>
        </div>

        {view === "offmarket" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line/80 pt-4">
            {KIND_OPTIONS.map((opt) => {
              const on = kinds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleKind(opt.id)}
                  className={`px-3 py-1.5 text-sm transition ${
                    on
                      ? "bg-forest text-paper"
                      : "border border-line bg-paper text-steel hover:border-ink"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-steel">
            Build cost ~{money(defaultHard)}/sf
            {hardCostOverride != null ? ` · using ${money(hardCostOverride)}/sf` : ""}
            {showAdvanced && maxMiles < 100
              ? ` · within ${maxMiles} mi`
              : ""}
          </p>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-medium text-copper hover:text-copper-deep"
          >
            {showAdvanced ? "Hide options" : "More options"}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-3 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <label className="block">
              <span className="flex justify-between text-xs font-medium text-steel">
                <span>Search radius</span>
                <span className="font-mono text-ink">{maxMiles} mi</span>
              </span>
              <input
                type="range"
                min={15}
                max={100}
                step={5}
                value={maxMiles}
                onChange={(e) => setMaxMiles(Number(e.target.value))}
                className="mt-3 w-full accent-copper"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-steel">
                Hard cost $/sf (optional)
              </span>
              <input
                type="number"
                min={50}
                max={500}
                placeholder={String(defaultHard)}
                value={hardOverride}
                onChange={(e) => setHardOverride(e.target.value)}
                className="mt-1.5 w-full border border-line bg-paper px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
      </div>

      {view === "offmarket" && selectedLead && (
        <div className="border border-ink bg-paper p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
                Selected deal
              </p>
              <h2 className="mt-1 font-display text-2xl text-ink">
                {selectedLead.lead.address}
              </h2>
              <p className="mt-1 text-sm text-steel">
                {selectedLead.lead.city} · {selectedLead.kindLabel} · APN{" "}
                {selectedLead.lead.apn} ·{" "}
                <span
                  className={
                    selectedLead.passes ? "text-canopy" : "text-copper-deep"
                  }
                >
                  {selectedLead.passes ? "Clears hurdle" : "Watch list"}
                </span>
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-steel">
                {selectedLead.thesis}
              </p>
              <ol className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-steel">
                <li>
                  <span className="font-mono text-copper">01</span> Site
                  screening
                </li>
                <li>
                  <span className="font-mono text-copper">02</span> Cost &amp;
                  underwriting
                </li>
                <li>
                  <span className="font-mono text-copper">03</span> Program /
                  design
                </li>
                <li>
                  <span className="font-mono text-copper">04</span> Docs &amp;
                  schedule
                </li>
              </ol>
            </div>
            <button
              type="button"
              disabled={starting}
              onClick={() => startPlanning(selectedLead)}
              className="shrink-0 bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-forest disabled:opacity-60"
            >
              {starting ? "Starting…" : "Start planning →"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden border border-line lg:grid lg:h-[min(72vh,760px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="max-h-[50vh] overflow-y-auto border-b border-line lg:max-h-none lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-10 border-b border-line bg-paper px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
              {view === "offmarket" ? "Off-market list" : "Submarkets"}
            </p>
            <p className="mt-1 text-sm text-steel">
              {view === "offmarket"
                ? `${visibleLeads.length} leads · ${leadPins.length} on map`
                : `${visibleSubs.length} areas · ${subPins.length} on map`}
            </p>
          </div>

          {view === "offmarket" && (
            <ul className="divide-y divide-line">
              {kinds.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-steel">
                  Select at least one opportunity type.
                </li>
              )}
              {kinds.length > 0 && visibleLeads.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-steel">
                  No leads clear this hurdle. Uncheck “only clear hurdle” to see
                  watch list.
                </li>
              )}
              {visibleLeads.map((r, i) => (
                <LeadListItem
                  key={r.lead.id}
                  result={r}
                  index={i}
                  selected={selectedId === r.lead.id}
                  onSelect={() => selectId(r.lead.id)}
                  onStart={() => startPlanning(r)}
                  itemRef={(el) => {
                    listItemRefs.current[r.lead.id] = el;
                  }}
                />
              ))}
            </ul>
          )}

          {view === "submarkets" && (
            <ul className="divide-y divide-line">
              {visibleSubs.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-steel">
                  No submarkets clear this hurdle.
                </li>
              )}
              {visibleSubs.map((r, i) => (
                <SubListItem
                  key={r.submarket.id}
                  result={r}
                  index={i}
                  selected={selectedId === r.submarket.id}
                  anchor={meta.anchor}
                  onSelect={() => selectId(r.submarket.id)}
                  itemRef={(el) => {
                    listItemRefs.current[r.submarket.id] = el;
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="relative h-[42vh] min-h-[320px] lg:h-full">
          <DealMap
            marketId={marketId}
            pins={activePins}
            selectedId={selectedId}
            onSelect={selectId}
          />
        </div>
      </div>
    </div>
  );
}

function LeadListItem({
  result: r,
  index,
  selected,
  onSelect,
  onStart,
  itemRef,
}: {
  result: OffMarketResult;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
  itemRef: (el: HTMLLIElement | null) => void;
}) {
  return (
    <li
      ref={itemRef}
      className={`px-4 py-4 transition ${
        selected ? "bg-limestone" : "hover:bg-limestone/50"
      }`}
    >
      <div
        className="flex cursor-pointer gap-3"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect();
        }}
        role="button"
        tabIndex={0}
      >
        <span className="font-mono text-sm text-copper">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-display text-lg text-ink">{r.lead.address}</h3>
            <span
              className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                r.passes
                  ? "bg-sage/20 text-canopy"
                  : "bg-copper/15 text-copper-deep"
              }`}
            >
              {r.passes ? "Deal" : "Watch"}
            </span>
          </div>
          <p className="mt-1 text-xs text-steel">
            {r.lead.city} · {r.kindLabel} · {money(r.lead.askingOrAssessed)} ·{" "}
            {(r.marginPct * 100).toFixed(0)}% margin
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-steel">{r.thesis}</p>
          {selected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStart();
              }}
              className="mt-3 text-sm font-medium text-copper hover:text-copper-deep"
            >
              Start planning with this deal →
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function SubListItem({
  result: r,
  index,
  selected,
  anchor,
  onSelect,
  itemRef,
}: {
  result: DealResult;
  index: number;
  selected: boolean;
  anchor: string;
  onSelect: () => void;
  itemRef: (el: HTMLLIElement | null) => void;
}) {
  return (
    <li
      ref={itemRef}
      className={`cursor-pointer px-4 py-4 transition ${
        selected ? "bg-limestone" : "hover:bg-limestone/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex gap-3">
        <span className="font-mono text-sm text-copper">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-display text-lg text-ink">
              {r.submarket.name}
            </h3>
            <span
              className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                r.passes
                  ? "bg-sage/20 text-canopy"
                  : "bg-copper/15 text-copper-deep"
              }`}
            >
              {r.passes ? "Pass" : "Thin"}
            </span>
          </div>
          <p className="mt-1 text-xs text-steel">
            {Math.round(r.submarket.milesFromAnchor)} mi from {anchor} ·{" "}
            {money(r.salePsf)}/sf · {(r.marginPct * 100).toFixed(0)}% margin
          </p>
        </div>
      </div>
    </li>
  );
}
