import type {
  BuildMode,
  Deal,
  DealProject,
  ProjectFile,
  ProjectFileKind,
  ProjectPhase,
} from "./types";
import { uid } from "./underwriting";

/** Soft caps — keep Project simple and snappy. */
export const PROJECT_MAX_FILES = 40;
export const PROJECT_MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB

const REHAB_PHASES = [
  "Due diligence & permits",
  "Demo & open-up",
  "Systems (MEP)",
  "Interior finishes",
  "Exterior & site",
  "Punch list & sale prep",
] as const;

const NEW_BUILD_PHASES = [
  "Plans, soft costs & permits",
  "Site & foundation",
  "Framing & envelope",
  "MEP rough-in",
  "Interior finishes",
  "Final, CO & closeout",
] as const;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return fallback.toISOString().slice(0, 10);
  }
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultPhases(
  buildMode: BuildMode,
  projectMonths = 6,
): ProjectPhase[] {
  const names =
    buildMode === "new_build" ? NEW_BUILD_PHASES : REHAB_PHASES;
  const months = Math.max(1, Math.min(36, Number(projectMonths) || 6));
  const totalDays = Math.round(months * 30);
  const slice = Math.max(7, Math.floor(totalDays / names.length));
  let cursor = todayIso();

  return names.map((name) => {
    const startDate = cursor;
    const endDate = addDays(startDate, slice - 1);
    cursor = addDays(endDate, 1);
    return {
      id: uid("phase"),
      name,
      startDate,
      endDate,
      progressPct: 0,
    };
  });
}

export function emptyProject(
  buildMode: BuildMode = "rehab",
  projectMonths = 6,
): DealProject {
  return {
    phases: defaultPhases(buildMode, projectMonths),
    notes: "",
    files: [],
  };
}

export function normalizeProject(
  raw: unknown,
  buildMode: BuildMode,
  projectMonths: number,
): DealProject {
  const base = emptyProject(buildMode, projectMonths);
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Partial<DealProject>;

  const phases: ProjectPhase[] = Array.isArray(p.phases)
    ? p.phases
        .filter((ph): ph is ProjectPhase => ph != null && typeof ph === "object")
        .map((ph) => ({
          id: typeof ph.id === "string" && ph.id ? ph.id : uid("phase"),
          name: String(ph.name ?? "Phase").trim() || "Phase",
          startDate: String(ph.startDate ?? "").slice(0, 10),
          endDate: String(ph.endDate ?? "").slice(0, 10),
          progressPct: clampPct(Number(ph.progressPct) || 0),
        }))
    : base.phases;

  const files: ProjectFile[] = Array.isArray(p.files)
    ? p.files
        .filter((f): f is ProjectFile => f != null && typeof f === "object")
        .map((f) => ({
          id: typeof f.id === "string" && f.id ? f.id : uid("file"),
          name: String(f.name ?? "file"),
          mimeType: String(f.mimeType ?? "application/octet-stream"),
          size: Math.max(0, Number(f.size) || 0),
          uploadedAt:
            typeof f.uploadedAt === "string"
              ? f.uploadedAt
              : new Date().toISOString(),
          kind: normalizeKind(f.kind, f.mimeType),
          storage:
            f.storage === "cloud" || f.storage === "both" || f.storage === "local"
              ? f.storage
              : f.cloudPath
                ? "cloud"
                : "local",
          cloudPath:
            typeof f.cloudPath === "string" && f.cloudPath
              ? f.cloudPath
              : null,
        }))
    : [];

  return {
    phases: phases.length ? phases : base.phases,
    notes: typeof p.notes === "string" ? p.notes : "",
    files,
  };
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeKind(
  kind: unknown,
  mimeType: unknown,
): ProjectFileKind {
  if (kind === "photo" || kind === "document" || kind === "other") return kind;
  const mime = String(mimeType ?? "");
  if (mime.startsWith("image/")) return "photo";
  if (
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("sheet") ||
    mime.includes("text")
  ) {
    return "document";
  }
  return "other";
}

export function fileKindFromMime(mimeType: string): ProjectFileKind {
  return normalizeKind(undefined, mimeType);
}

/** Average of phase progress, unweighted (simple on purpose). */
export function overallProjectProgress(phases: ProjectPhase[]): number {
  if (!phases.length) return 0;
  const sum = phases.reduce((s, p) => s + clampPct(p.progressPct), 0);
  return Math.round(sum / phases.length);
}

export function constructionBudget(deal: Deal): number {
  return (deal.costItems ?? []).reduce(
    (s, i) => s + (Number(i.amount) || 0),
    0,
  );
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
