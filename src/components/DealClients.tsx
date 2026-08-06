"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createDeal,
  dealTitle,
  deleteDeal,
  getDeal,
  listDeals,
  saveDeal,
  templateCostItems,
} from "@/lib/deals";
import type { Deal } from "@/lib/types";
import { DealWorkspace } from "./DealWorkspace";

export function NewDealClient() {
  const router = useRouter();
  const [buildMode, setBuildMode] = useState<Deal["buildMode"]>("rehab");
  const [propertyClass, setPropertyClass] =
    useState<Deal["propertyClass"]>("residential");

  function start() {
    const deal = createDeal({
      buildMode,
      propertyClass,
      costItems: templateCostItems(buildMode, propertyClass),
    });
    saveDeal(deal);
    router.push(`/deals/${deal.id}`);
  }

  return (
    <div className="relative mx-auto max-w-xl px-5 py-14 sm:px-8 sm:py-20">
      <div
        className="pointer-events-none absolute -right-4 top-8 font-display text-[8rem] leading-none text-ink/[0.04] sm:text-[11rem]"
        aria-hidden
      >
        $
      </div>

      <p className="page-label">New deal</p>
      <h1 className="page-title mt-3 text-4xl sm:text-5xl">
        How are you building?
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
        Ground-up or rehab, residential or commercial. You can change this
        later inside the deal.
      </p>

      <div className="relative mt-12 space-y-9">
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Build path
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["rehab", "Rehab", "Improve an existing building"],
                ["new_build", "Ground-up", "Build from the dirt"],
              ] as const
            ).map(([id, title, sub]) => (
              <button
                key={id}
                type="button"
                data-active={buildMode === id}
                onClick={() => setBuildMode(id)}
                className="select-tile px-4 py-5"
              >
                <span className="block font-display text-xl tracking-tight">
                  {title}
                </span>
                <span
                  className={`mt-1.5 block text-sm leading-snug ${
                    buildMode === id ? "text-paper/75" : "text-muted"
                  }`}
                >
                  {sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Asset class
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["residential", "Residential"],
                ["commercial", "Commercial"],
              ] as const
            ).map(([id, title]) => (
              <button
                key={id}
                type="button"
                data-active={propertyClass === id}
                onClick={() => setPropertyClass(id)}
                className="select-tile px-4 py-4 font-display text-xl tracking-tight"
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={start} className="btn-signal w-full py-3.5">
          Create deal studio
        </button>
      </div>
    </div>
  );
}

export function DealsListClient() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDeals(listDeals());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="px-5 py-20 text-sm text-muted sm:px-8">Loading…</div>
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="page-label">Workspace</p>
          <h1 className="page-title mt-2 text-4xl sm:text-5xl">My deals</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Ground-up and rehab deal files — open any one to edit property,
            costs, and final numbers.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/deals/find" className="btn-ghost">
            Find deals
          </Link>
          <Link href="/deals/new" className="btn-signal">
            New deal
          </Link>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="mt-14 border border-dashed border-line bg-stone/50 px-6 py-20 text-center">
          <p className="page-label">Empty studio</p>
          <p className="mt-3 font-display text-3xl tracking-tight text-ink">
            No deals yet
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Start a ground-up or rehab deal. Itemize costs and run final numbers
            for flip or hold — or screen open-data leads first.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/deals/find" className="btn-ghost">
              Find deals
            </Link>
            <Link href="/deals/new" className="btn-signal">
              Create your first deal
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-12 divide-y divide-line border border-line bg-surface">
          {deals.map((d) => (
            <li
              key={d.id}
              className="group flex flex-wrap items-center justify-between gap-4 px-5 py-5 transition hover:bg-stone/40"
            >
              <div>
                <Link
                  href={`/deals/${d.id}`}
                  className="font-display text-2xl tracking-tight text-ink transition group-hover:text-canopy"
                >
                  {dealTitle(d)}
                </Link>
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <span className="text-signal">
                    {d.buildMode === "new_build" ? "Ground-up" : "Rehab"}
                  </span>
                  {" · "}
                  {d.propertyClass}
                  {d.property.city ? ` · ${d.property.city}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={`/deals/${d.id}`}
                  className="text-sm font-semibold text-signal transition hover:text-brass-deep"
                >
                  Open →
                </Link>
                <button
                  type="button"
                  className="text-sm text-muted transition hover:text-loss"
                  onClick={() => {
                    deleteDeal(d.id);
                    setDeals(listDeals());
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DealEditorClient({ id }: { id: string }) {
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [tab, setTab] = useState<"property" | "costs" | "analysis">(
    "property",
  );
  const [flash, setFlash] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const found = getDeal(id);
    if (!found) {
      setMissing(true);
      return;
    }
    setDeal(found);
  }, [id]);

  if (missing) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
        <p className="page-label">Missing</p>
        <p className="page-title mt-3 text-3xl">Deal not found</p>
        <Link href="/deals" className="btn-signal mt-8 inline-block">
          Back to deals
        </Link>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="px-5 py-20 text-sm text-muted sm:px-8">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <DealWorkspace
        deal={deal}
        tab={tab}
        onTab={setTab}
        savedFlash={flash}
        onChange={(next) => {
          setDeal(next);
        }}
        onSave={() => {
          saveDeal(deal);
          setFlash(true);
          window.setTimeout(() => setFlash(false), 1600);
        }}
      />
      <p className="mt-12 border-t border-line pt-6">
        <button
          type="button"
          className="text-sm font-medium text-muted transition hover:text-signal"
          onClick={() => router.push("/deals")}
        >
          ← All deals
        </button>
      </p>
    </div>
  );
}
