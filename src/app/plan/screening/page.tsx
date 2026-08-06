"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FeaturePageShell } from "@/components/FeaturePageShell";
import { useWorkspace } from "@/context/WorkspaceContext";

type ZoneResult = {
  address: string;
  parcelId: string;
  zoning: string;
  lotSf: number;
  frontSetback: number;
  sideSetback: number;
  rearSetback: number;
  maxHeight: string;
  far: number;
  buildableSf: number;
  flags: { level: "ok" | "warn" | "block"; text: string }[];
};

function ScreeningInner() {
  const params = useSearchParams();
  const projectId = params.get("project");
  const { getProject, ready } = useWorkspace();
  const project = projectId ? getProject(projectId) : undefined;

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ZoneResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || !project) return;
    const addr =
      project.property?.address ||
      project.address ||
      project.name;
    setQuery(addr);
  }, [ready, project]);

  function runScreen(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);

    const prop = project?.property;
    window.setTimeout(() => {
      const lotSf = prop?.lotSf ?? 12500;
      const state = prop?.state || "TX";
      setResult({
        address: query.includes(",")
          ? query
          : `${query}${prop?.city ? `, ${prop.city}` : ""}${state ? `, ${state}` : ""}`,
        parcelId: prop?.apn || project?.sourceLeadId || "—",
        zoning:
          prop?.propertyType?.includes("Multifamily") ||
          project?.productType?.includes("mf")
            ? "MF / multi-unit candidacy (verify local)"
            : "SF / residential candidacy (verify local)",
        lotSf: Math.round(lotSf),
        frontSetback: 20,
        sideSetback: 5,
        rearSetback: 10,
        maxHeight: project?.productType?.includes("midrise")
          ? "65 ft / mid-rise"
          : "35–40 ft / residential",
        far: project?.productType?.includes("mf") ? 1.5 : 0.55,
        buildableSf: Math.round(lotSf * (project?.productType?.includes("mf") ? 1.2 : 0.4)),
        flags: [
          {
            level: "ok",
            text: prop?.apn
              ? `Assessor APN ${prop.apn} on project record`
              : "No APN on file — pull CAD data before PSA",
          },
          {
            level: prop?.landValue && prop.landValue > 0 ? "ok" : "warn",
            text: prop?.landValue
              ? `Land assessed ~$${Math.round(prop.landValue).toLocaleString()}`
              : "Land value not loaded from deal",
          },
          {
            level: "warn",
            text: "Setbacks / zoning are heuristics — confirm with city GIS and survey",
          },
          {
            level: "ok",
            text: project?.planNotes
              ? "Deal thesis attached on project overview"
              : "Continue to cost modeling after flags clear",
          },
        ],
      });
      setLoading(false);
    }, 700);
  }

  const nextAnalysis = projectId
    ? `/workspace/${projectId}/analysis`
    : "/plan/cost";
  const nextDesign = projectId
    ? `/plan/generative?project=${projectId}`
    : "/plan/generative";

  return (
    <FeaturePageShell
      eyebrow="Plan & Design · Site Screening"
      title="Know the constraints before you design."
      description={
        project
          ? `Screening for ${project.name} — next, underwrite cost on this project.`
          : "Pull property records, setbacks, and local zoning into a single screening brief — so spatial programming starts from reality, not assumptions."
      }
    >
      {projectId && (
        <p className="mb-6 text-sm text-steel">
          Project linked.{" "}
          <Link
            href={`/workspace/${projectId}`}
            className="text-copper hover:text-copper-deep"
          >
            Back to planning steps
          </Link>
        </p>
      )}

      <form
        onSubmit={runScreen}
        className="flex flex-col gap-3 border border-line bg-limestone p-5 sm:flex-row sm:items-end"
      >
        <label className="flex-1">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
            Parcel address or APN
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 1014 Heiner St, Houston, TX"
            className="mt-2 w-full border border-line bg-paper px-4 py-3 text-sm outline-none ring-copper focus:ring-1"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-forest disabled:opacity-60"
        >
          {loading ? "Screening…" : "Screen site"}
        </button>
      </form>

      {loading && (
        <p className="mt-8 animate-pulse-soft font-mono text-sm text-sage">
          Querying records · zoning · setbacks…
        </p>
      )}

      {result && (
        <div className="mt-10 animate-rise grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="font-display text-2xl text-ink">{result.address}</h2>
            <p className="mt-1 font-mono text-xs text-sage">
              Parcel {result.parcelId}
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-3">
              {[
                ["Zoning", result.zoning],
                ["Lot area", `${result.lotSf.toLocaleString()} sf`],
                ["FAR", String(result.far)],
                ["Front setback", `${result.frontSetback} ft`],
                ["Side setback", `${result.sideSetback} ft`],
                ["Rear setback", `${result.rearSetback} ft`],
                ["Max height", result.maxHeight],
                ["Est. buildable", `${result.buildableSf.toLocaleString()} sf`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wider text-sage">
                    {k}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border border-line bg-paper p-5">
            <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
              Screening flags
            </h3>
            <ul className="mt-4 space-y-3">
              {result.flags.map((flag) => (
                <li
                  key={flag.text}
                  className="flex gap-3 border-b border-line pb-3 text-sm last:border-0"
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      flag.level === "ok"
                        ? "bg-sage"
                        : flag.level === "warn"
                          ? "bg-copper"
                          : "bg-red-700"
                    }`}
                  />
                  <span className="text-steel">{flag.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={nextAnalysis}
                className="inline-flex bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-forest"
              >
                Next: cost & underwriting →
              </Link>
              <Link
                href={nextDesign}
                className="text-sm font-medium text-copper hover:text-copper-deep"
              >
                Or generate unit mix / design →
              </Link>
            </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <p className="mt-10 text-sm text-steel">
          {project
            ? "Address pulled from your deal — click Screen site to continue."
            : "Enter an address or start a deal from Deal Finder to pull parcel context."}
        </p>
      )}
    </FeaturePageShell>
  );
}

export default function ScreeningPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-5 py-20 text-sm text-steel">
          Loading screening…
        </div>
      }
    >
      <ScreeningInner />
    </Suspense>
  );
}
