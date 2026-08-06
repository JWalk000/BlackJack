"use client";

import { use, useMemo, useState } from "react";
import {
  ProjectWorkspaceLayout,
  WorkspaceReady,
} from "@/components/workspace/AuthGate";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { ScheduleTask } from "@/lib/types";

const STATUS_COLOR = {
  done: "bg-sage",
  "on-track": "bg-forest",
  "at-risk": "bg-copper",
  delayed: "bg-red-700",
};

function ProgressView({ projectId }: { projectId: string }) {
  const { getProject, updateSchedule } = useWorkspace();
  const project = getProject(projectId);
  const [week, setWeek] = useState(12);
  const horizon = 90;

  const summary = useMemo(() => {
    if (!project) return { done: 0, risk: 0, avg: 0 };
    const done = project.schedule.filter((t) => t.status === "done").length;
    const risk = project.schedule.filter(
      (t) => t.status === "at-risk" || t.status === "delayed",
    ).length;
    const avg = Math.round(
      project.schedule.reduce((a, t) => a + t.progress, 0) /
        Math.max(project.schedule.length, 1),
    );
    return { done, risk, avg };
  }, [project]);

  if (!project) return null;

  function bumpProgress(taskId: string, delta: number) {
    const next: ScheduleTask[] = project!.schedule.map((t) => {
      if (t.id !== taskId) return t;
      const progress = Math.min(100, Math.max(0, t.progress + delta));
      let status = t.status;
      if (progress === 100) status = "done";
      else if (status === "done") status = "on-track";
      return { ...t, progress, status };
    });
    updateSchedule(projectId, next);
  }

  function cycleStatus(taskId: string) {
    const order: ScheduleTask["status"][] = [
      "on-track",
      "at-risk",
      "delayed",
      "done",
    ];
    const next = project!.schedule.map((t) => {
      if (t.id !== taskId) return t;
      const i = order.indexOf(t.status);
      const status = order[(i + 1) % order.length];
      return {
        ...t,
        status,
        progress: status === "done" ? 100 : t.progress === 100 ? 90 : t.progress,
      };
    });
    updateSchedule(projectId, next);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
        Execution · Schedule
      </p>
      <h1 className="mt-2 font-display text-4xl text-ink">
        Progress & schedule
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-steel">
        Track milestones, mark risk, and advance progress. Changes save to this
        project in your browser.
      </p>

      <div className="mt-10 mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Overall progress", value: `${summary.avg}%` },
          {
            label: "Phases complete",
            value: `${summary.done}/${project.schedule.length}`,
          },
          { label: "Needs attention", value: String(summary.risk) },
        ].map((stat) => (
          <div key={stat.label} className="border border-line bg-limestone p-5">
            <p className="text-xs uppercase tracking-wider text-sage">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-3xl text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <label className="mb-6 block max-w-md">
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

          <ul className="space-y-5">
            {project.schedule.map((task) => (
              <li key={task.id}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="text-sage">{task.phase} · </span>
                    <span className="font-medium text-ink">{task.name}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cycleStatus(task.id)}
                      className="px-2 py-0.5 text-[10px] uppercase tracking-wider text-steel underline-offset-2 hover:underline"
                    >
                      {task.status}
                    </button>
                    <button
                      type="button"
                      onClick={() => bumpProgress(task.id, -10)}
                      className="border border-line px-2 py-0.5 text-xs"
                    >
                      −
                    </button>
                    <span className="font-mono text-xs text-steel">
                      {task.progress}%
                    </span>
                    <button
                      type="button"
                      onClick={() => bumpProgress(task.id, 10)}
                      className="border border-line px-2 py-0.5 text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="relative h-7 bg-limestone">
                  <div
                    className={`absolute top-1 bottom-1 ${STATUS_COLOR[task.status]} opacity-90`}
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
    </div>
  );
}

export default function ProjectProgressPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <WorkspaceReady>
      <ProjectWorkspaceLayout projectId={projectId}>
        <ProgressView projectId={projectId} />
      </ProjectWorkspaceLayout>
    </WorkspaceReady>
  );
}
