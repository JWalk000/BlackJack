"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type AreaComp,
  AREA_COMPS,
  defaultCompsTable,
  formatZhviAsOf,
  getAreaCompsMeta,
  hasLiveAreaComps,
  HOME_DEAL_THRESHOLD,
} from "@/data/area-comps";
import {
  getFinderInventory,
  getFreeLeadsMeta,
  inventoryMode,
  type FreeLeadListing,
} from "@/data/listings";
import type { Listing, SampleListing } from "@/data/sample-listings";
import {
  type ScoredListing,
  filterAndRankListings,
  formatDiscount,
  formatUnitPrice,
  osmBrowseUrl,
  osmEmbedUrl,
  scoreLead,
} from "@/lib/deal-finder";
import { createDeal, saveDeal, templateCostItems } from "@/lib/deals";
import { money } from "@/lib/underwriting";
import { useBilling } from "@/lib/billing/context";
import { checkCanCreateDeal } from "@/lib/billing/entitlements";
import { Field, MoneyInput, NumberInput, inputClass } from "./ui";
import { BillingToast, type BillingToastState } from "./BillingToast";

type LeadForm = {
  type: "home" | "land";
  address: string;
  city: string;
  county: string;
  state: string;
  price: number;
  buildingSf: number | null;
  acres: number | null;
};

const emptyLead = (): LeadForm => ({
  type: "home",
  address: "",
  city: "",
  county: "Harris",
  state: "TX",
  price: 0,
  buildingSf: null,
  acres: null,
});

function sourceBadge(listing: Listing | FreeLeadListing): string {
  if (listing.source === "user") return "Your lead";
  if (listing.source === "sample") return "Demo sample";
  if (listing.provider === "hcad" || listing.id?.startsWith("hcad-"))
    return "Harris CAD";
  if (listing.provider === "fbcad" || listing.id?.startsWith("fbcad-"))
    return "Fort Bend CAD";
  if (listing.source === "free-cad") return "Open CAD";
  return listing.provider || listing.source || "Open data";
}

export function DealFinder() {
  const router = useRouter();
  const { isPro, freeDealsCreated, recordFreeDealCreated } = useBilling();
  const inventory = useMemo(() => getFinderInventory(), []);
  const leadsMeta = useMemo(() => getFreeLeadsMeta(), []);
  const compsMeta = useMemo(() => getAreaCompsMeta(), []);
  const mode = inventoryMode();

  const [typeFilter, setTypeFilter] = useState<"all" | "home" | "land">("all");
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [mustPass, setMustPass] = useState(true);
  const [countyFilter, setCountyFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [lead, setLead] = useState<LeadForm>(emptyLead);
  const [comps, setComps] = useState<AreaComp[]>(() => defaultCompsTable());
  const [showComps, setShowComps] = useState(false);
  const [toast, setToast] = useState<BillingToastState>({
    open: false,
    message: "",
  });

  const allListings = useMemo(
    () => [...userListings, ...inventory],
    [userListings, inventory],
  );

  const ranked = useMemo(
    () =>
      filterAndRankListings(allListings, comps, {
        type: typeFilter,
        maxPrice: maxPrice > 0 ? maxPrice : null,
        mustPass,
        county: countyFilter || null,
      }),
    [allListings, comps, typeFilter, maxPrice, mustPass, countyFilter],
  );

  const selected =
    ranked.find((l) => l.id === selectedId) ?? ranked[0] ?? null;

  const leadScore = useMemo(
    () =>
      scoreLead(
        {
          type: lead.type,
          price: lead.price,
          buildingSf: lead.buildingSf,
          acres: lead.acres,
          county: lead.county,
          state: lead.state,
        },
        comps,
      ),
    [lead, comps],
  );

  const counties = useMemo(() => {
    const set = new Set(AREA_COMPS.map((c) => c.county));
    allListings.forEach((l) => set.add(l.county));
    return Array.from(set).sort();
  }, [allListings]);

  const cadAsOf =
    leadsMeta.sources.find((s) => s.id === "hcad" || s.id === "fbcad")?.asOf ||
    leadsMeta.asOf ||
    "—";

  async function startDealFromListing(
    listing: ScoredListing | Listing | SampleListing,
  ) {
    const gate = checkCanCreateDeal(isPro, {
      cloudFreeDealsCreated: freeDealsCreated,
    });
    if (!gate.ok) {
      setToast({ open: true, message: gate.message });
      return;
    }
    const isLand = listing.type === "land";
    const lotSf =
      listing.acres != null && listing.acres > 0
        ? Math.round(listing.acres * 43560)
        : null;
    const deal = createDeal({
      buildMode: isLand ? "new_build" : "rehab",
      propertyClass: isLand ? "commercial" : "residential",
      property: {
        name: listing.title,
        description: [
          listing.notes,
          listing.priceMethod,
          listing.apn ? `APN ${listing.apn}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        apn: listing.apn ?? "",
        bedrooms: null,
        bathsFull: null,
        bathsHalf: null,
        yearBuilt: null,
        buildingSf: listing.buildingSf ?? null,
        lotSf,
        units: isLand ? null : 1,
        floors: isLand ? null : 1,
        propertyType: isLand ? "Land / development" : "Single family",
        zoning: "",
        condition: isLand ? "Vacant" : "Fair",
        lastSaleAmount: null,
        lastSaleDate: "",
        taxAssessment: listing.price,
        taxAmount: null,
      },
      assumptions: {
        purchasePrice: listing.price,
        closingCosts: Math.round(listing.price * 0.04),
        closingCostsManual: false,
        projectMonths: 6,
        monthsToSaleOrRent: 2,
        costOfSalePct: 7,
        arv: 0,
        grossRentMonthly: 0,
        otherIncomeMonthly: 0,
        vacancyPct: 5,
        operatingExpensesMonthly: 0,
        refinance: false,
        permanentLtvPct: 75,
        permanentRatePct: 6.5,
        permanentTermYears: 30,
      },
      costItems: templateCostItems(
        isLand ? "new_build" : "rehab",
        isLand ? "commercial" : "residential",
      ),
    });
    saveDeal(deal);
    if (!isPro) {
      await recordFreeDealCreated();
    }
    router.push(`/deals/${deal.id}`);
  }

  function addLeadAsListing() {
    if (!(lead.price > 0) || !lead.county.trim()) return;
    if (lead.type === "home" && !(Number(lead.buildingSf) > 0)) return;
    if (lead.type === "land" && !(Number(lead.acres) > 0)) return;

    const id = `user_${Date.now().toString(36)}`;
    const anchor =
      allListings.find(
        (l) => l.county.toLowerCase() === lead.county.toLowerCase(),
      ) ??
      allListings[0] ?? {
        lat: 29.76,
        lng: -95.37,
      };

    const listing: Listing = {
      id,
      type: lead.type,
      title: lead.address.trim() || `Lead · ${lead.city || lead.county}`,
      address: lead.address.trim() || "Address TBD",
      city: lead.city.trim() || lead.county,
      county: lead.county.trim(),
      state: lead.state.trim() || "TX",
      zip: "",
      price: lead.price,
      priceLabel: "User entered",
      priceMethod: "User-entered ask or offer (not CAD)",
      buildingSf: lead.type === "home" ? Number(lead.buildingSf) : undefined,
      buildingSfSource: lead.type === "home" ? "user" : undefined,
      acres: lead.type === "land" ? Number(lead.acres) : undefined,
      lat: anchor.lat + (Math.random() - 0.5) * 0.04,
      lng: anchor.lng + (Math.random() - 0.5) * 0.04,
      notes: "User-entered lead",
      source: "user",
      provider: "user",
    };
    setUserListings((prev) => [listing, ...prev]);
    setSelectedId(id);
    setLead(emptyLead());
  }

  function updateComp(
    county: string,
    field: "medianHomePsf" | "avgLandPerAcre",
    value: number,
  ) {
    setComps((prev) =>
      prev.map((c) =>
        c.county === county ? { ...c, [field]: value } : c,
      ),
    );
  }

  const zhviLabel = formatZhviAsOf(compsMeta.asOf);
  const typicalSf = compsMeta.typicalHomeSf ?? 1900;

  return (
    <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="page-label">Screening</p>
          <h1 className="page-title mt-2 text-4xl sm:text-5xl">Find deals</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Screen Houston-area homes and vacant land against public area
            averages from Zillow Research ZHVI and county assessor GIS. Paste
            your own lead anytime — not live MLS.
          </p>
        </div>
        <Link href="/deals" className="btn-ghost">
          My deals
        </Link>
      </div>

      <div className="mt-8 border border-line bg-surface px-5 py-4 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center border border-line bg-stone/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
            ZHVI {zhviLabel}
            {hasLiveAreaComps() ? "" : " · fallback"}
          </span>
          <span className="inline-flex items-center border border-line bg-stone/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
            CAD {cadAsOf}
          </span>
          <span className="inline-flex items-center border border-line bg-stone/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
            {mode === "free-cad"
              ? `${inventory.length} open-data parcels`
              : `${inventory.length} demo samples`}
          </span>
          {compsMeta.fhfa?.yoyPct != null ? (
            <span className="inline-flex items-center border border-line bg-stone/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
              FHFA HPI {compsMeta.fhfa.yoyPct > 0 ? "+" : ""}
              {compsMeta.fhfa.yoyPct}% YoY
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {leadsMeta.disclaimer} Home $/sf ≈ county ZHVI ÷ {typicalSf} finished
          sf
          {compsMeta.researchPage ? (
            <>
              {" "}
              (
              <a
                href={compsMeta.researchPage}
                className="font-medium text-signal hover:text-brass-deep"
                target="_blank"
                rel="noreferrer"
              >
                Zillow Research
              </a>
              , as of {zhviLabel})
            </>
          ) : null}
          . Refresh offline:{" "}
          <code className="text-[11px] text-ink">npm run data:pull</code>
        </p>
      </div>

      <div className="mt-6 border border-line bg-surface p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Filters
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Type">
            <select
              className={inputClass}
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "all" | "home" | "land")
              }
            >
              <option value="all">All</option>
              <option value="home">Improved homes</option>
              <option value="land">Land / vacant</option>
            </select>
          </Field>
          <Field label="Max assessor value">
            <MoneyInput
              value={maxPrice}
              onChange={setMaxPrice}
              placeholder="No max"
            />
          </Field>
          <Field label="County">
            <select
              className={inputClass}
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
            >
              <option value="">All counties</option>
              {counties.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hurdle">
            <label className="mt-1 flex cursor-pointer items-center gap-3 rounded border border-line bg-stone/40 px-3 py-3">
              <input
                type="checkbox"
                className="size-4 accent-[var(--signal)]"
                checked={mustPass}
                onChange={(e) => setMustPass(e.target.checked)}
              />
              <span className="text-sm text-ink">
                Must pass deal hurdle
                <span className="mt-0.5 block text-xs text-muted">
                  Homes ≤ {Math.round(HOME_DEAL_THRESHOLD * 100)}% of area
                  $/sf · land &lt; area $/ac
                </span>
              </span>
            </label>
          </Field>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl tracking-tight text-ink">
              Ranked leads
            </h2>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {ranked.length} shown
            </p>
          </div>

          {ranked.length === 0 ? (
            <div className="mt-4 border border-dashed border-line bg-stone/40 px-5 py-14 text-center">
              <p className="font-display text-xl text-ink">No matches</p>
              <p className="mt-2 text-sm text-muted">
                Relax filters or paste a custom lead below.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line border border-line bg-surface">
              {ranked.map((l) => {
                const active = selected?.id === l.id;
                const unit =
                  l.type === "home"
                    ? formatUnitPrice(l.score.listUnitPrice, "sf")
                    : formatUnitPrice(l.score.listUnitPrice, "acre");
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(l.id)}
                      className={`w-full px-4 py-4 text-left transition sm:px-5 ${
                        active
                          ? "bg-forest text-paper"
                          : "hover:bg-stone/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p
                            className={`font-display text-lg tracking-tight sm:text-xl ${
                              active ? "text-paper" : "text-ink"
                            }`}
                          >
                            {l.title}
                          </p>
                          <p
                            className={`mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                              active ? "text-sand/80" : "text-muted"
                            }`}
                          >
                            {l.type === "home" ? "Home" : "Land"} · {l.city},{" "}
                            {l.county} County · {money(l.price)}
                            {l.priceLabel ? ` · ${l.priceLabel}` : ""}
                            {" · "}
                            {sourceBadge(l)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            l.score.isGoodDeal
                              ? active
                                ? "text-brass"
                                : "text-profit"
                              : active
                                ? "text-sand/70"
                                : "text-muted"
                          }`}
                        >
                          {l.score.isGoodDeal ? "Good deal" : "Below hurdle"}
                        </span>
                      </div>
                      <div
                        className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm ${
                          active ? "text-sand/90" : "text-muted"
                        }`}
                      >
                        <span>{unit}</span>
                        <span>{formatDiscount(l.score.discountVsArea)}</span>
                        {l.score.areaUnitPrice != null ? (
                          <span>
                            Area{" "}
                            {formatUnitPrice(
                              l.score.areaUnitPrice,
                              l.type === "home" ? "sf" : "acre",
                            )}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {selected ? (
            <div className="border border-line bg-surface">
              <div className="border-b border-line px-4 py-4">
                <p className="page-label">Selected</p>
                <h3 className="mt-1 font-display text-xl tracking-tight text-ink">
                  {selected.title}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {selected.address}
                  <br />
                  {selected.city}, {selected.state} {selected.zip}
                  <br />
                  {selected.county} County
                  {selected.apn ? (
                    <>
                      <br />
                      APN {selected.apn}
                    </>
                  ) : null}
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-signal">
                  {sourceBadge(selected)}
                  {selected.sourceAsOf ? ` · as of ${selected.sourceAsOf}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-px bg-line">
                <div className="bg-stone/50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {selected.priceLabel || "Value"} unit
                  </p>
                  <p className="mt-1 font-display text-lg text-ink">
                    {formatUnitPrice(
                      selected.score.listUnitPrice,
                      selected.type === "home" ? "sf" : "acre",
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {money(selected.price)}
                    {selected.priceLabel ? ` · ${selected.priceLabel}` : ""}
                  </p>
                </div>
                <div className="bg-stone/50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Margin vs area
                  </p>
                  <p
                    className={`mt-1 font-display text-lg ${
                      selected.score.isGoodDeal ? "text-profit" : "text-ink"
                    }`}
                  >
                    {formatDiscount(selected.score.discountVsArea)}
                  </p>
                </div>
              </div>

              <p className="border-b border-line px-4 py-3 text-xs leading-relaxed text-muted">
                {selected.score.reason}
                {selected.type === "home" && selected.buildingSf
                  ? ` · ${selected.buildingSf.toLocaleString()} sf${
                      selected.buildingSfSource === "typical-proxy"
                        ? " (typical proxy)"
                        : ""
                    }`
                  : null}
                {selected.type === "land" && selected.acres
                  ? ` · ${selected.acres} ac`
                  : null}
                {selected.priceMethod ? (
                  <>
                    <br />
                    <span className="mt-1 inline-block">
                      Method: {selected.priceMethod}
                    </span>
                  </>
                ) : null}
                {selected.buildingSfNote ? (
                  <>
                    <br />
                    {selected.buildingSfNote}
                  </>
                ) : null}
              </p>

              <div className="relative aspect-[4/3] w-full bg-stone">
                <iframe
                  title={`Map of ${selected.title}`}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={osmEmbedUrl(selected.lat, selected.lng)}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-[11px] text-muted">
                <span>
                  {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
                </span>
                <a
                  href={osmBrowseUrl(selected.lat, selected.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-signal hover:text-brass-deep"
                >
                  Open map →
                </a>
              </div>

              <div className="border-t border-line p-4">
                <button
                  type="button"
                  className="btn-signal w-full py-3"
                  onClick={() => void startDealFromListing(selected)}
                >
                  Start deal from lead
                </button>
                <p className="mt-2 text-center text-[11px] text-muted">
                  Screening only — confirm list price with a realtor.
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-line bg-stone/40 px-4 py-10 text-center text-sm text-muted">
              Select a lead to see location and scores.
            </div>
          )}

          {ranked.length > 0 ? (
            <div className="border border-line bg-surface px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Pins
              </p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                {ranked.slice(0, 12).map((l) => (
                  <li key={`pin-${l.id}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(l.id)}
                      className="w-full text-left text-muted transition hover:text-signal"
                    >
                      <span className="text-signal">◆</span> {l.city}{" "}
                      <span className="text-xs">
                        ({l.lat.toFixed(2)}, {l.lng.toFixed(2)})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <section className="mt-14 border border-line bg-surface">
        <div className="border-b border-line px-5 py-5 sm:px-6">
          <p className="page-label">Custom lead</p>
          <h2 className="mt-2 font-display text-2xl tracking-tight text-ink sm:text-3xl">
            Score a paste-in
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Enter a list price or offer yourself — useful when CAD is only a
            proxy or you have a real ask.
          </p>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <Field label="Type">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["home", "Home"],
                  ["land", "Land"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-active={lead.type === id}
                  onClick={() => setLead((p) => ({ ...p, type: id }))}
                  className="select-tile px-3 py-2.5 text-sm font-medium"
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Address">
            <input
              className={inputClass}
              value={lead.address}
              onChange={(e) =>
                setLead((p) => ({ ...p, address: e.target.value }))
              }
              placeholder="Street or parcel note"
            />
          </Field>
          <Field label="City">
            <input
              className={inputClass}
              value={lead.city}
              onChange={(e) =>
                setLead((p) => ({ ...p, city: e.target.value }))
              }
            />
          </Field>
          <Field label="County">
            <select
              className={inputClass}
              value={lead.county}
              onChange={(e) =>
                setLead((p) => ({ ...p, county: e.target.value }))
              }
            >
              {AREA_COMPS.map((c) => (
                <option key={c.county} value={c.county}>
                  {c.county}, {c.state}
                </option>
              ))}
            </select>
          </Field>
          <Field label="List / offer price">
            <MoneyInput
              value={lead.price}
              onChange={(n) => setLead((p) => ({ ...p, price: n }))}
            />
          </Field>
          {lead.type === "home" ? (
            <Field label="Building sqft">
              <NumberInput
                value={lead.buildingSf}
                onChange={(n) => setLead((p) => ({ ...p, buildingSf: n }))}
                min={1}
                step={10}
              />
            </Field>
          ) : (
            <Field label="Acres">
              <NumberInput
                value={lead.acres}
                onChange={(n) => setLead((p) => ({ ...p, acres: n }))}
                min={0.01}
                step={0.1}
              />
            </Field>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-stone/40 px-5 py-4 sm:px-6">
          <div>
            <p
              className={`text-sm font-semibold ${
                leadScore.isGoodDeal ? "text-profit" : "text-ink"
              }`}
            >
              {leadScore.isGoodDeal ? "Passes hurdle" : "Does not pass"}
              {" · "}
              {formatUnitPrice(
                leadScore.listUnitPrice,
                lead.type === "home" ? "sf" : "acre",
              )}
              {" · "}
              {formatDiscount(leadScore.discountVsArea)}
            </p>
            <p className="mt-0.5 text-xs text-muted">{leadScore.reason}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={addLeadAsListing}
            >
              Add to list
            </button>
            <button
              type="button"
              className="btn-signal"
              onClick={() => {
                if (!(lead.price > 0)) return;
                const listing: Listing = {
                  id: "scratch",
                  type: lead.type,
                  title: lead.address || "Custom lead",
                  address: lead.address || "Address TBD",
                  city: lead.city || lead.county,
                  county: lead.county,
                  state: lead.state,
                  zip: "",
                  price: lead.price,
                  priceLabel: "User entered",
                  priceMethod: "User-entered ask or offer",
                  buildingSf: lead.buildingSf ?? undefined,
                  buildingSfSource: "user",
                  acres: lead.acres ?? undefined,
                  lat: 29.76,
                  lng: -95.37,
                  source: "user",
                  provider: "user",
                };
                void startDealFromListing(listing);
              }}
            >
              Start deal from lead
            </button>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <button
          type="button"
          onClick={() => setShowComps((v) => !v)}
          className="flex w-full items-center justify-between border border-line bg-surface px-5 py-4 text-left transition hover:bg-stone/40 sm:px-6"
        >
          <div>
            <p className="page-label">Benchmarks</p>
            <p className="mt-1 font-display text-xl tracking-tight text-ink">
              County market averages
            </p>
            <p className="mt-1 text-xs text-muted">
              ZHVI-derived homes $/sf ({zhviLabel}) · land $/acre from CAD
              sample or metro proxy — editable for local judgment
            </p>
          </div>
          <span className="text-sm font-semibold text-signal">
            {showComps ? "Hide" : "Edit"}
          </span>
        </button>
        {showComps ? (
          <div className="border border-t-0 border-line bg-surface overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <th className="px-4 py-3">County</th>
                  <th className="px-4 py-3">Median home $/sf</th>
                  <th className="px-4 py-3">Avg land $/acre</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.county} className="border-b border-line/80">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {c.county}, {c.state}
                      {c.zhvi ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-muted">
                          ZHVI {money(c.zhvi)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 max-w-[8rem]">
                      <NumberInput
                        value={c.medianHomePsf}
                        min={1}
                        onChange={(n) =>
                          updateComp(c.county, "medianHomePsf", n ?? 0)
                        }
                      />
                    </td>
                    <td className="px-4 py-2 max-w-[10rem]">
                      <NumberInput
                        value={c.avgLandPerAcre}
                        min={1}
                        step={1000}
                        onChange={(n) =>
                          updateComp(c.county, "avgLandPerAcre", n ?? 0)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-muted">
              {compsMeta.method ?? "County ZHVI-derived $/sf."}{" "}
              {compsMeta.landMethod ?? ""} Screening only — not an appraisal.
              Re-pull snapshot offline:{" "}
              <code className="text-ink">npm run data:pull</code> (no runtime
              scrape).
            </p>
          </div>
        ) : null}
      </section>
      <BillingToast
        state={toast}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
}
