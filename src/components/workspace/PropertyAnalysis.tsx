"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { CostModeling } from "@/components/CostModeling";
import type { PropertyInfo, UnderwritingAssumptions } from "@/lib/types";
import {
  defaultPropertyInfo,
  defaultUnderwriting,
  sampleGetData,
  sanitizeUnderwriting,
} from "@/lib/underwriting";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type Tab = "property" | "cost";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-sage">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full border border-line bg-paper px-3 py-2 text-sm outline-none ring-copper focus:ring-1";

export function PropertyAnalysis({ projectId }: { projectId: string }) {
  const { getProject, updateProject } = useWorkspace();
  const project = getProject(projectId);

  const [tab, setTab] = useState<Tab>("property");
  const [savedFlash, setSavedFlash] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [searchBy, setSearchBy] = useState<"address" | "apn">("address");

  const [property, setProperty] = useState<PropertyInfo>(
    defaultPropertyInfo(),
  );
  const [uw, setUw] = useState<UnderwritingAssumptions>(
    defaultUnderwriting(),
  );

  useEffect(() => {
    if (!project) return;
    setProperty(
      project.property ??
        defaultPropertyInfo(project.address, project.name),
    );
    setUw(
      sanitizeUnderwriting(
        project.underwriting ?? defaultUnderwriting(),
      ),
    );
  }, [project]);

  if (!project) return null;

  function patchProperty(patch: Partial<PropertyInfo>) {
    setProperty((p) => ({ ...p, ...patch }));
  }

  function save() {
    updateProject(projectId, {
      property,
      underwriting: uw,
      address: property.address || project!.address,
      name: property.propertyName || project!.name,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }

  function getData() {
    setPulling(true);
    const q =
      searchBy === "apn"
        ? property.apn || property.address || project!.address
        : property.address || project!.address || property.propertyName;
    window.setTimeout(() => {
      const data = sampleGetData(q);
      setProperty((p) => ({
        ...p,
        ...data,
        propertyName: p.propertyName || data.address || project!.name,
      }));
      if (data.estValue) {
        setUw((u) => ({
          ...u,
          arv: data.estValue ?? u.arv,
          resalePrice: data.estValue ?? u.resalePrice,
          purchasePrice: data.lastSaleAmount
            ? Math.round(data.lastSaleAmount * 0.95)
            : u.purchasePrice,
        }));
      }
      setPulling(false);
    }, 700);
  }

  const maxBar = Math.max(
    property.estValue ?? 0,
    property.lastSaleAmount ?? 0,
    property.taxAssessment ?? 0,
    1,
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
            Deal toolkit
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
            Property & cost
          </h1>
          <p className="mt-2 max-w-xl text-sm text-steel">
            Property record first; cost modeling combines regional build cost
            with flip and rent / BRRRR underwriting.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedFlash && (
            <span className="text-sm text-canopy">Saved to project</span>
          )}
          <button
            type="button"
            onClick={save}
            className="bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-forest"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-line pb-3">
        {(
          [
            ["property", "Property info"],
            ["cost", "Cost modeling"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm transition ${
              tab === id
                ? "bg-ink text-paper"
                : "border border-line text-steel hover:border-ink hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cost" && (
        <div className="mt-8">
          <CostModeling
            key={`${projectId}-cost`}
            initialUw={uw}
            initialGsf={property.sqft}
            initialUnits={property.units}
            initialRegion={
              property.state === "VA" ? "virginia" : "houston"
            }
            onUwChange={setUw}
          />
          <button
            type="button"
            onClick={save}
            className="mt-6 bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-forest"
          >
            Save cost model to project
          </button>
        </div>
      )}

      {tab === "property" && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <Field label="Property name">
              <input
                className={inputClass}
                value={property.propertyName}
                onChange={(e) =>
                  patchProperty({ propertyName: e.target.value })
                }
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                className={inputClass}
                value={property.description}
                onChange={(e) =>
                  patchProperty({ description: e.target.value })
                }
              />
            </Field>

            <div className="flex gap-2 text-sm">
              {(
                [
                  ["address", "Address"],
                  ["apn", "APN"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSearchBy(id)}
                  className={`px-3 py-1.5 ${
                    searchBy === id
                      ? "bg-forest text-paper"
                      : "border border-line text-steel"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Field label={searchBy === "address" ? "Street address" : "APN"}>
              <input
                className={inputClass}
                value={
                  searchBy === "address" ? property.address : property.apn
                }
                onChange={(e) =>
                  patchProperty(
                    searchBy === "address"
                      ? { address: e.target.value }
                      : { apn: e.target.value },
                  )
                }
                placeholder={
                  searchBy === "address"
                    ? "1847 Oakridge Blvd, Houston, TX"
                    : "APN / parcel ID"
                }
              />
            </Field>

            <button
              type="button"
              onClick={getData}
              disabled={pulling}
              className="w-full bg-copper px-4 py-3 text-sm font-medium text-paper transition hover:bg-copper-deep disabled:opacity-60"
            >
              {pulling ? "Pulling records…" : "Get data"}
            </button>
            <p className="text-xs text-steel">
              Demo pull fills owner, lot, tax, and estimate. Continue to cost
              modeling for flip / rent returns with regional build bands.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner name">
                <input
                  className={inputClass}
                  value={property.ownerName}
                  onChange={(e) =>
                    patchProperty({ ownerName: e.target.value })
                  }
                />
              </Field>
              <Field label="Mailing">
                <input
                  className={inputClass}
                  value={property.ownerMailing}
                  onChange={(e) =>
                    patchProperty({ ownerMailing: e.target.value })
                  }
                />
              </Field>
              <Field label="City">
                <input
                  className={inputClass}
                  value={property.city}
                  onChange={(e) => patchProperty({ city: e.target.value })}
                />
              </Field>
              <Field label="State / ZIP">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={property.state}
                    onChange={(e) => patchProperty({ state: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    value={property.zip}
                    onChange={(e) => patchProperty({ zip: e.target.value })}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ["Beds", "beds"],
                  ["Baths", "baths"],
                  ["Sq. ft.", "sqft"],
                  ["Year built", "yearBuilt"],
                  ["Units", "units"],
                  ["Lot acres", "lotAcres"],
                ] as const
              ).map(([label, key]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    className={inputClass}
                    value={property[key] ?? ""}
                    onChange={(e) =>
                      patchProperty({
                        [key]: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="Lot sq. ft.">
                <input
                  type="number"
                  className={inputClass}
                  value={property.lotSf ?? ""}
                  onChange={(e) =>
                    patchProperty({
                      lotSf: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
              <Field label="Zoning">
                <input
                  className={inputClass}
                  value={property.zoning}
                  onChange={(e) => patchProperty({ zoning: e.target.value })}
                />
              </Field>
              <Field label="Type">
                <select
                  className={inputClass}
                  value={property.propertyType}
                  onChange={(e) =>
                    patchProperty({ propertyType: e.target.value })
                  }
                >
                  <option>Single Family</option>
                  <option>Duplex</option>
                  <option>Triplex / Fourplex</option>
                  <option>Townhome</option>
                  <option>Multifamily (5+ units)</option>
                  <option>Vacant Land</option>
                </select>
              </Field>
            </div>

            <div className="border border-line bg-limestone p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-sage">
                Deal potential snapshot
              </p>
              <div className="mt-4 space-y-3">
                {(
                  [
                    ["Est. value", property.estValue, "bg-forest"],
                    ["Last sale", property.lastSaleAmount, "bg-copper"],
                    ["Tax assess.", property.taxAssessment, "bg-sage"],
                  ] as const
                ).map(([label, value, color]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs text-steel">
                      <span>{label}</span>
                      <span className="font-medium text-ink">
                        {value != null ? money(value) : "—"}
                      </span>
                    </div>
                    <div className="h-2 bg-paper">
                      <div
                        className={`h-full ${color}`}
                        style={{
                          width: `${value != null ? Math.min(100, (value / maxBar) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Field label="Est. value">
                  <input
                    type="number"
                    className={inputClass}
                    value={property.estValue ?? ""}
                    onChange={(e) =>
                      patchProperty({
                        estValue: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field label="Last sale amt">
                  <input
                    type="number"
                    className={inputClass}
                    value={property.lastSaleAmount ?? ""}
                    onChange={(e) =>
                      patchProperty({
                        lastSaleAmount: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field label="Land value">
                  <input
                    type="number"
                    className={inputClass}
                    value={property.landValue ?? ""}
                    onChange={(e) =>
                      patchProperty({
                        landValue: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field label="Improvement value">
                  <input
                    type="number"
                    className={inputClass}
                    value={property.improvementValue ?? ""}
                    onChange={(e) =>
                      patchProperty({
                        improvementValue: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={() => setTab("cost")}
                className="mt-6 w-full border border-ink px-4 py-3 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
              >
                Continue to cost modeling →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
