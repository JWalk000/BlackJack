"use client";

import { useMemo, useState } from "react";
import { FeaturePageShell } from "@/components/FeaturePageShell";
import { FloorPlanPlate } from "@/components/FloorPlanPlate";

type Mix = {
  id: string;
  name: string;
  units: number;
  studio: number;
  oneBed: number;
  twoBed: number;
  threeBed: number;
  efficiency: number;
  parking: number;
};

const MIXES: Mix[] = [
  {
    id: "a",
    name: "Urban Compact",
    units: 84,
    studio: 18,
    oneBed: 36,
    twoBed: 24,
    threeBed: 6,
    efficiency: 0.82,
    parking: 92,
  },
  {
    id: "b",
    name: "Family Weighted",
    units: 68,
    studio: 4,
    oneBed: 16,
    twoBed: 32,
    threeBed: 16,
    efficiency: 0.78,
    parking: 110,
  },
  {
    id: "c",
    name: "Workforce Balance",
    units: 96,
    studio: 28,
    oneBed: 44,
    twoBed: 20,
    threeBed: 4,
    efficiency: 0.85,
    parking: 78,
  },
];

export default function GenerativePage() {
  const [density, setDensity] = useState(70);
  const [familyBias, setFamilyBias] = useState(40);
  const [selected, setSelected] = useState("a");

  const ranked = useMemo(() => {
    return [...MIXES]
      .map((m) => {
        const densityScore = Math.abs(m.units - density * 1.2);
        const familyScore = Math.abs(
          (m.twoBed + m.threeBed) / m.units - familyBias / 100,
        );
        return { ...m, score: densityScore * 0.4 + familyScore * 80 };
      })
      .sort((a, b) => a.score - b.score);
  }, [density, familyBias]);

  const active = ranked.find((m) => m.id === selected) ?? ranked[0];

  return (
    <FeaturePageShell
      eyebrow="Plan & Design · Generative Design"
      title="Instant spatial programming for unit mix options."
      description="Set target density and household bias for multifamily programs — Estate erects a typical floor plate and unit schematics. For single-family or duplex product, use Cost Modeling with Deal Finder."
    >
      <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-8 border border-line bg-limestone p-6">
          <label className="block">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-ink">Target density</span>
              <span className="font-mono text-sage">{density} du/ac</span>
            </div>
            <input
              type="range"
              min={40}
              max={120}
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="mt-3 w-full accent-copper"
            />
          </label>
          <label className="block">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-ink">Family-unit bias</span>
              <span className="font-mono text-sage">{familyBias}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={70}
              value={familyBias}
              onChange={(e) => setFamilyBias(Number(e.target.value))}
              className="mt-3 w-full accent-copper"
            />
          </label>
          <p className="text-sm leading-relaxed text-steel">
            Programs reorder as inputs change. Select a mix to redraw the
            typical floor plate and unit plans.
          </p>
          <a
            href="/plan/cost"
            className="inline-flex text-sm font-medium text-copper hover:text-copper-deep"
          >
            Model cost for selected mix →
          </a>
        </div>

        <div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {ranked.map((mix, i) => (
              <button
                key={mix.id}
                type="button"
                onClick={() => setSelected(mix.id)}
                className={`shrink-0 border px-4 py-3 text-left transition ${
                  selected === mix.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper text-ink hover:border-sage"
                }`}
              >
                <span className="block font-mono text-[10px] uppercase tracking-wider opacity-70">
                  Option {String.fromCharCode(65 + i)}
                </span>
                <span className="mt-1 block text-sm font-medium">{mix.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 border border-line bg-paper p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-ink">{active.name}</h2>
                <p className="mt-1 text-sm text-steel">
                  {active.units} units · {(active.efficiency * 100).toFixed(0)}%
                  efficiency · {active.parking} stalls
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Studio", active.studio],
                ["1 Bed", active.oneBed],
                ["2 Bed", active.twoBed],
                ["3 Bed", active.threeBed],
              ].map(([label, count]) => (
                <div key={label as string} className="bg-limestone p-4">
                  <p className="text-xs uppercase tracking-wider text-sage">
                    {label}
                  </p>
                  <p className="mt-2 font-display text-3xl text-ink">{count}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <FloorPlanPlate
                key={active.id}
                name={active.name}
                mix={{
                  studio: active.studio,
                  oneBed: active.oneBed,
                  twoBed: active.twoBed,
                  threeBed: active.threeBed,
                  units: active.units,
                  efficiency: active.efficiency,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </FeaturePageShell>
  );
}
