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
  constructionBudget,
  defaultPhases,
  fileKindFromMime,
  formatFileSize,
  overallProjectProgress,
  PROJECT_MAX_FILE_BYTES,
  PROJECT_MAX_FILES,
} from "@/lib/project";
import { money, uid } from "@/lib/underwriting";
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
}: {
  deal: Deal;
  onChange: (deal: Deal) => void;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const project = deal.project;
  const budget = useMemo(() => constructionBudget(deal), [deal]);
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
        const path = cloudFilePath(user.id, deal.id, id, file.name);
        const up = await uploadDealFileCloud(path, file, file.type || "application/octet-stream");
        if (!up.error) {
          storage = "both";
          cloudPath = path;
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
    <div className="space-y-8">
      <div className="border-b border-line pb-6">
        <p className="page-label">After the numbers</p>
        <h2 className="page-title mt-2 text-3xl sm:text-4xl">Project</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Numbers said the deal works — keep the job simple here: budget
          snapshot, a light schedule, and files in one place.
        </p>
      </div>

      <section className="panel grid gap-6 p-5 sm:grid-cols-3 sm:p-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Construction budget
          </p>
          <p className="mt-2 font-display text-3xl tracking-tight text-ink">
            {money(budget)}
          </p>
          <p className="mt-1 text-xs text-muted">From itemized costs</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Overall progress
          </p>
          <p className="mt-2 font-display text-3xl tracking-tight text-ink">
            {progress}%
          </p>
          <div className="mt-3 h-2 overflow-hidden bg-stone">
            <div
              className="h-full bg-signal transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Timeline
          </p>
          <p className="mt-2 font-display text-3xl tracking-tight text-ink">
            {deal.assumptions.projectMonths || "—"}
            <span className="ml-1 text-lg font-sans text-muted">mo</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            From Final numbers · edit phases below
          </p>
        </div>
      </section>

      <section className="panel space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-label">Schedule</p>
            <h3 className="mt-2 font-display text-2xl tracking-tight text-ink">
              Build phases
            </h3>
            <p className="mt-1 max-w-lg text-sm text-muted">
              Six phases by default — set dates and drag progress. No
              Gantt required.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={resetPhaseTemplate}
          >
            Reset template
          </button>
        </div>

        <ul className="divide-y divide-line border border-line">
          {project.phases.map((phase, index) => (
            <li key={phase.id} className="space-y-3 bg-paper p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <input
                  className={`${inputClass} min-w-0 flex-1 font-medium`}
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
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Start">
                  <input
                    type="date"
                    className={inputClass}
                    value={phase.startDate}
                    onChange={(e) =>
                      updatePhase(phase.id, { startDate: e.target.value })
                    }
                  />
                </Field>
                <Field label="End">
                  <input
                    type="date"
                    className={inputClass}
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

      <section className="panel space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-label">Job folder</p>
            <h3 className="mt-2 font-display text-2xl tracking-tight text-ink">
              Files & photos
            </h3>
            <p className="mt-1 max-w-lg text-sm text-muted">
              Plans, bids, and progress pictures. Up to {PROJECT_MAX_FILES}{" "}
              files, 12&nbsp;MB each.
              {!user
                ? " Stored in this browser until you sign in."
                : " Saved on this device and the cloud when available."}
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
              className="btn-signal"
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
          <p className="border border-dashed border-line bg-stone/30 px-4 py-10 text-center text-sm text-muted">
            No files yet — drop plans and site photos here once you greenlight
            the deal.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {project.files.map((file) => (
              <li
                key={file.id}
                className="flex flex-col border border-line bg-paper"
              >
                <button
                  type="button"
                  onClick={() => void openFile(file)}
                  className="block min-h-36 w-full overflow-hidden bg-stone/40 text-left transition hover:bg-stone/60"
                >
                  {file.kind === "photo" && previewUrls[file.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrls[file.id]}
                      alt={file.name}
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 flex-col items-center justify-center gap-1 px-3 text-center">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        {file.kind === "document" ? "Document" : "File"}
                      </span>
                      <span className="line-clamp-2 text-sm font-medium text-ink">
                        {file.name}
                      </span>
                    </div>
                  )}
                </button>
                <div className="flex items-start justify-between gap-2 border-t border-line px-3 py-2">
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

      <section className="panel space-y-4 p-5 sm:p-7">
        <div>
          <p className="page-label">Field notes</p>
          <h3 className="mt-2 font-display text-2xl tracking-tight text-ink">
            Job notes
          </h3>
          <p className="mt-1 text-sm text-muted">
            One running note for the job — keeps daily life simple.
          </p>
        </div>
        <textarea
          className={`${inputClass} min-h-32`}
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
