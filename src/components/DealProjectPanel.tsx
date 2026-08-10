"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Deal, ProjectFile, ProjectPhase } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import {
  cloudFilePath,
  removeDealFileCloud,
  signedDealFileUrl,
  uploadDealFileCloud,
} from "@/lib/deal-file-cloud";
import {
  deleteLocalFileBlob,
  getLocalFileBlob,
  putLocalFileBlob,
} from "@/lib/deal-file-store";
import {
  defaultPhases,
  fileKindFromMime,
  formatFileSize,
  overallProjectProgress,
  PROJECT_MAX_FILE_BYTES,
  PROJECT_MAX_FILES,
} from "@/lib/project";
import { uid } from "@/lib/underwriting";
import { DealBudgetStrip } from "./DealBudgetStrip";
import { Field, inputClass } from "./ui";

function patchProject(
  deal: Deal,
  patch: Partial<Deal["project"]>,
): Deal {
  return {
    ...deal,
    project: { ...deal.project, ...patch },
  };
}

export function DealProjectPanel({
  deal,
  onChange,
  onGoToCosts,
}: {
  deal: Deal;
  onChange: (deal: Deal) => void;
  onGoToCosts?: () => void;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const project = deal.project;
  const progress = useMemo(
    () => overallProjectProgress(project.phases),
    [project.phases],
  );

  const revokePreviews = useCallback((urls: Record<string, string>) => {
    for (const u of Object.values(urls)) {
      if (u.startsWith("blob:")) URL.revokeObjectURL(u);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const next: Record<string, string> = {};

    async function load() {
      for (const f of project.files) {
        if (f.kind !== "photo") continue;
        const local = await getLocalFileBlob(deal.id, f.id);
        if (local) {
          next[f.id] = URL.createObjectURL(local);
          continue;
        }
        if (f.cloudPath) {
          const signed = await signedDealFileUrl(f.cloudPath);
          if (signed) next[f.id] = signed;
        }
      }
      if (cancelled) {
        revokePreviews(next);
        return;
      }
      setPreviewUrls((prev) => {
        revokePreviews(prev);
        return next;
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when file ids / storage change
  }, [
    deal.id,
    project.files.map((f) => `${f.id}:${f.cloudPath ?? ""}:${f.storage}`).join("|"),
    revokePreviews,
  ]);

  useEffect(() => {
    return () => revokePreviews(previewUrls);
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPhases(phases: ProjectPhase[]) {
    onChange(patchProject(deal, { phases }));
  }

  function updatePhase(id: string, patch: Partial<ProjectPhase>) {
    setPhases(
      project.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function resetPhaseTemplate() {
    setPhases(
      defaultPhases(deal.buildMode, deal.assumptions.projectMonths),
    );
    setMessage("Schedule reset to a simple build template.");
  }

  async function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    setMessage(null);
    setBusy(true);

    const remaining = PROJECT_MAX_FILES - project.files.length;
    if (remaining <= 0) {
      setBusy(false);
      setMessage(`Cap is ${PROJECT_MAX_FILES} files per deal — remove some first.`);
      return;
    }

    const accepted = Array.from(list).slice(0, remaining);
    const added: ProjectFile[] = [];
    const errors: string[] = [];

    for (const file of accepted) {
      if (file.size > PROJECT_MAX_FILE_BYTES) {
        errors.push(`${file.name} is over 12 MB`);
        continue;
      }
      const id = uid("file");
      try {
        await putLocalFileBlob(deal.id, id, file);
      } catch {
        errors.push(`${file.name} could not be saved in this browser`);
        continue;
      }

      let storage: ProjectFile["storage"] = "local";
      let cloudPath: string | null = null;

      if (user) {
        const path = cloudFilePath(deal.id, id, file.name);
        const up = await uploadDealFileCloud(path, file, file.type || "application/octet-stream");
        if (!up.error) {
          storage = "both";
          cloudPath = path;
        } else {
          // Keep local if cloud rejected (e.g. storage policy not applied yet)
          errors.push(`${file.name}: cloud ${up.error}`);
        }
      }

      added.push({
        id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date().toISOString(),
        kind: fileKindFromMime(file.type || ""),
        storage,
        cloudPath,
      });
    }

    if (added.length) {
      onChange(
        patchProject(deal, { files: [...project.files, ...added] }),
      );
    }

    const parts: string[] = [];
    if (added.length) {
      parts.push(
        `Added ${added.length} file${added.length === 1 ? "" : "s"}${
          user ? "" : " (this browser)"
        }.`,
      );
    }
    if (errors.length) parts.push(errors.slice(0, 3).join(" · "));
    if (list.length > remaining) {
      parts.push(`Only ${remaining} slot${remaining === 1 ? "" : "s"} left.`);
    }
    setMessage(parts.join(" ") || null);
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeFile(file: ProjectFile) {
    setBusy(true);
    await deleteLocalFileBlob(deal.id, file.id);
    if (file.cloudPath) await removeDealFileCloud(file.cloudPath);
    onChange(
      patchProject(deal, {
        files: project.files.filter((f) => f.id !== file.id),
      }),
    );
    setBusy(false);
  }

  async function openFile(file: ProjectFile) {
    const local = await getLocalFileBlob(deal.id, file.id);
    if (local) {
      const url = URL.createObjectURL(local);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    if (file.cloudPath) {
      const signed = await signedDealFileUrl(file.cloudPath);
      if (signed) {
        window.open(signed, "_blank", "noopener,noreferrer");
        return;
      }
    }
    setMessage("Could not open that file on this device.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
        <div>
          <p className="page-label">Project</p>
          <h2 className="page-title mt-0.5 text-2xl sm:text-3xl">
            Build execution
          </h2>
        </div>
        <p className="max-w-md text-xs text-muted sm:text-right">
          Budget, schedule, and files once the numbers work.
        </p>
      </div>

      <DealBudgetStrip
        deal={deal}
        mode="summary"
        onGoToCosts={onGoToCosts}
      />

      <section className="panel grid gap-4 px-3 py-3 sm:grid-cols-2 sm:px-4 sm:py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Overall progress
          </p>
          <p className="mt-0.5 font-display text-2xl tracking-tight text-ink">
            {progress}%
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden bg-stone">
            <div
              className="h-full bg-signal transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Timeline
          </p>
          <p className="mt-0.5 font-display text-2xl tracking-tight text-ink">
            {deal.assumptions.projectMonths || "—"}
            <span className="ml-1 text-base font-sans text-muted">mo</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            From Final numbers · edit phases below
          </p>
        </div>
      </section>

      <section className="panel space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="page-label">Schedule</p>
            <h3 className="mt-0.5 font-display text-xl tracking-tight text-ink">
              Build phases
            </h3>
          </div>
          <button
            type="button"
            className="btn-ghost !min-h-9 px-3 text-sm"
            onClick={resetPhaseTemplate}
          >
            Reset template
          </button>
        </div>

        <ul className="divide-y divide-line border border-line">
          {project.phases.map((phase, index) => (
            <li key={phase.id} className="space-y-2 bg-paper p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <input
                  className={`${inputClass} min-h-9 min-w-0 flex-1 py-1.5 font-medium`}
                  value={phase.name}
                  onChange={(e) =>
                    updatePhase(phase.id, { name: e.target.value })
                  }
                  aria-label={`Phase ${index + 1} name`}
                />
                <span className="text-sm tabular-nums text-muted">
                  {phase.progressPct}%
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Start">
                  <input
                    type="date"
                    className={`${inputClass} min-h-9 py-1.5`}
                    value={phase.startDate}
                    onChange={(e) =>
                      updatePhase(phase.id, { startDate: e.target.value })
                    }
                  />
                </Field>
                <Field label="End">
                  <input
                    type="date"
                    className={`${inputClass} min-h-9 py-1.5`}
                    value={phase.endDate}
                    onChange={(e) =>
                      updatePhase(phase.id, { endDate: e.target.value })
                    }
                  />
                </Field>
                <Field label="Progress">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    className="mt-2 w-full accent-[var(--signal)]"
                    value={phase.progressPct}
                    onChange={(e) =>
                      updatePhase(phase.id, {
                        progressPct: Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="page-label">Files</p>
            <h3 className="mt-0.5 font-display text-xl tracking-tight text-ink">
              Files & photos
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Up to {PROJECT_MAX_FILES} files, 12&nbsp;MB each
              {!user
                ? " · this browser until sign-in"
                : deal.teamId
                  ? " · team-shared when deal is"
                  : " · device + cloud when available"}
              .
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="sr-only"
              onChange={(e) => void onPickFiles(e.target.files)}
            />
            <button
              type="button"
              className="btn-signal !min-h-10"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? "Working…" : "Add files"}
            </button>
          </div>
        </div>

        {message ? (
          <p className="text-sm text-muted" role="status">
            {message}
          </p>
        ) : null}

        {project.files.length === 0 ? (
          <p className="border border-dashed border-line bg-stone/30 px-3 py-6 text-center text-sm text-muted">
            No files yet.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {project.files.map((file) => (
              <li
                key={file.id}
                className="flex flex-col border border-line bg-paper"
              >
                <button
                  type="button"
                  onClick={() => void openFile(file)}
                  className="block min-h-28 w-full overflow-hidden bg-stone/40 text-left transition hover:bg-stone/60"
                >
                  {file.kind === "photo" && previewUrls[file.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrls[file.id]}
                      alt={file.name}
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-28 flex-col items-center justify-center gap-1 px-3 text-center">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        {file.kind === "document" ? "Document" : "File"}
                      </span>
                      <span className="line-clamp-2 text-sm font-medium text-ink">
                        {file.name}
                      </span>
                    </div>
                  )}
                </button>
                <div className="flex items-start justify-between gap-2 border-t border-line px-3 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatFileSize(file.size)}
                      {file.storage === "local" ? " · local" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-muted transition hover:text-loss"
                    disabled={busy}
                    onClick={() => void removeFile(file)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel space-y-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="page-label">Notes</p>
            <h3 className="mt-0.5 font-display text-xl tracking-tight text-ink">
              Job notes
            </h3>
          </div>
        </div>
        <textarea
          className={`${inputClass} min-h-20`}
          value={project.notes}
          onChange={(e) =>
            onChange(patchProject(deal, { notes: e.target.value }))
          }
          placeholder="Subs on site, inspections, client updates…"
        />
      </section>
    </div>
  );
}
