"use client";

import { useMemo, useState } from "react";
import { FeaturePageShell } from "@/components/FeaturePageShell";

type Task = {
  id: string;
  phase: string;
  name: string;
  start: number;
  duration: number;
  progress: number;
  status: "on-track" | "at-risk" | "done" | "delayed";
};

const TASKS: Task[] = [
  {
    id: "1",
    phase: "Entitlements",
    name: "Zoning confirmation & variance package",
    start: 0,
    duration: 18,
    progress: 100,
    status: "done",
  },
  {
    id: "2",
    phase: "Diligence",
    name: "Title cure & easement recording",
    start: 4,
    duration: 14,
    progress: 70,
    status: "at-risk",
  },
  {
    id: "3",
    phase: "Design",
    name: "Schematic design & unit mix lock",
    start: 10,
    duration: 16,
    progress: 55,
    status: "on-track",
  },
  {
    id: "4",
    phase: "Permitting",
    name: "Building permit submission",
    start: 22,
    duration: 20,
    progress: 15,
    status: "on-track",
  },
  {
    id: "5",
    phase: "Construction",
    name: "Foundation & structure",
    start: 40,
    duration: 28,
    progress: 0,
    status: "delayed",
  },
  {
    id: "6",
    phase: "Construction",
    name: "Envelope & interiors",
    start: 58,
    duration: 32,
    progress: 0,
    status: "on-track",
  },
];

const STATUS_COLOR = {
  done: "bg-sage",
  "on-track": "bg-forest",
  "at-risk": "bg-copper",
  delayed: "bg-red-700",
};

export default function ProgressPage() {
  const [week, setWeek] = useState(18);
  const horizon = 90;

  const summary = useMemo(() => {
    const done = TASKS.filter((t) => t.status === "done").length;
    const risk = TASKS.filter(
      (t) => t.status === "at-risk" || t.status === "delayed",
    ).length;
    const avg =
      TASKS.reduce((a, t) => a + t.progress, 0) / Math.max(TASKS.length, 1);
    return { done, risk, avg: Math.round(avg) };
  }, []);

  return (
    <FeaturePageShell
      eyebrow="Execution · Progress & Schedule"
      title="Progress tracking and schedule control."
      description="See where the project sits against plan — milestones, slippage, and phase health in one timeline."
    >
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Overall progress", value: `${summary.avg}%` },
          { label: "Phases complete", value: `${summary.done}/${TASKS.length}` },
          { label: "Items needing attention", value: String(summary.risk) },
        ].map((stat) => (
          <div key={stat.label} className="border border-line bg-limestone p-5">
            <p className="text-xs uppercase tracking-wider text-sage">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-3xl text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <label className="min-w-[200px] flex-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-ink">Current week</span>
            <span className="font-mono text-sage">W{week}</span>
          </div>
          <input
            type="range"
            min={0}
            max={horizon}
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="mt-3 w-full accent-copper"
          />
        </label>
        <div className="flex flex-wrap gap-3 text-xs text-steel">
          {(
            [
              ["done", "Done"],
              ["on-track", "On track"],
              ["at-risk", "At risk"],
              ["delayed", "Delayed"],
            ] as const
          ).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <i className={`inline-block h-2.5 w-2.5 ${STATUS_COLOR[k]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-line bg-paper">
        <div className="min-w-[720px] p-4">
          <div className="relative mb-2 h-6 border-b border-line">
            <div
              className="absolute top-0 bottom-0 w-px bg-copper"
              style={{ left: `${(week / horizon) * 100}%` }}
            />
            <span
              className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-copper"
              style={{ left: `${(week / horizon) * 100}%` }}
            >
              NOW
            </span>
          </div>

          <ul className="space-y-4">
            {TASKS.map((task) => (
              <li key={task.id}>
                <div className="mb-1 flex justify-between gap-4 text-sm">
                  <span>
                    <span className="text-sage">{task.phase} · </span>
                    <span className="font-medium text-ink">{task.name}</span>
                  </span>
                  <span className="font-mono text-xs text-steel">
                    {task.progress}%
                  </span>
                </div>
                <div className="relative h-7 bg-limestone">
                  <div
                    className={`absolute top-1 bottom-1 ${STATUS_COLOR[task.status]} opacity-90 transition-all`}
                    style={{
                      left: `${(task.start / horizon) * 100}%`,
                      width: `${(task.duration / horizon) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute top-1 bottom-1 bg-white/35"
                    style={{
                      left: `${(task.start / horizon) * 100}%`,
                      width: `${((task.duration * task.progress) / 100 / horizon) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </FeaturePageShell>
  );
}
