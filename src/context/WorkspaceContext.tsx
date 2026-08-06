"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createBlankProject } from "@/lib/projects";
import { getLocalOwnerId, storage } from "@/lib/storage";
import type { Project, ProjectDocument, ScheduleTask } from "@/lib/types";
import { useAuth } from "./AuthContext";

type ProjectInput = {
  name: string;
  address: string;
  region: string;
  property?: Project["property"];
  underwriting?: Project["underwriting"];
  sourceLeadId?: string;
  productType?: string;
  planNotes?: string;
};

type WorkspaceContextValue = {
  ready: boolean;
  projects: Project[];
  ownerId: string;
  isGuest: boolean;
  createProject: (input: ProjectInput) => Project | null;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  addDocument: (projectId: string, doc: ProjectDocument) => void;
  updateDocument: (
    projectId: string,
    docId: string,
    patch: Partial<ProjectDocument>,
  ) => void;
  removeDocument: (projectId: string, docId: string) => void;
  updateSchedule: (projectId: string, schedule: ScheduleTask[]) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [ownerId, setOwnerId] = useState("guest");

  useEffect(() => {
    if (!authReady) return;
    const oid = getLocalOwnerId(session);
    setOwnerId(oid);
    const all = storage.getProjects();
    setProjects(all.filter((p) => p.ownerId === oid));
    setReady(true);
  }, [authReady, session]);

  const persist = useCallback(
    (nextOwned: Project[]) => {
      const oid = getLocalOwnerId(session);
      const others = storage.getProjects().filter((p) => p.ownerId !== oid);
      storage.saveProjects([...others, ...nextOwned]);
      setProjects(nextOwned);
    },
    [session],
  );

  const createProject = useCallback(
    (input: ProjectInput) => {
      const oid = getLocalOwnerId(session);
      const project = createBlankProject(oid, input);
      const next = [project, ...projects];
      persist(next);
      return project;
    },
    [session, projects, persist],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>) => {
      const next = projects.map((p) =>
        p.id === id
          ? { ...p, ...patch, updatedAt: new Date().toISOString() }
          : p,
      );
      persist(next);
    },
    [projects, persist],
  );

  const deleteProject = useCallback(
    (id: string) => {
      persist(projects.filter((p) => p.id !== id));
    },
    [projects, persist],
  );

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  );

  const addDocument = useCallback(
    (projectId: string, doc: ProjectDocument) => {
      const next = projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              documents: [doc, ...p.documents],
              status: p.status === "planning" ? "diligence" : p.status,
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      persist(next);
    },
    [projects, persist],
  );

  const updateDocument = useCallback(
    (projectId: string, docId: string, patch: Partial<ProjectDocument>) => {
      const next = projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              documents: p.documents.map((d) =>
                d.id === docId ? { ...d, ...patch } : d,
              ),
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      persist(next);
    },
    [projects, persist],
  );

  const removeDocument = useCallback(
    (projectId: string, docId: string) => {
      const next = projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              documents: p.documents.filter((d) => d.id !== docId),
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      persist(next);
    },
    [projects, persist],
  );

  const updateSchedule = useCallback(
    (projectId: string, schedule: ScheduleTask[]) => {
      updateProject(projectId, { schedule, status: "execution" });
    },
    [updateProject],
  );

  const isGuest = !session;

  const value = useMemo(
    () => ({
      ready,
      projects,
      ownerId,
      isGuest,
      createProject,
      updateProject,
      deleteProject,
      getProject,
      addDocument,
      updateDocument,
      removeDocument,
      updateSchedule,
    }),
    [
      ready,
      projects,
      ownerId,
      isGuest,
      createProject,
      updateProject,
      deleteProject,
      getProject,
      addDocument,
      updateDocument,
      removeDocument,
      updateSchedule,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
