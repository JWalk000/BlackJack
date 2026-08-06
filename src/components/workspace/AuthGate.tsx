"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useWorkspace } from "@/context/WorkspaceContext";

/** Workspace is open without login. Only account settings require sign-in. */
export function WorkspaceReady({ children }: { children: React.ReactNode }) {
  const { ready: authReady } = useAuth();
  const { ready } = useWorkspace();

  if (!authReady || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-steel">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}

/** Optional login only for profile / password management. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) {
      router.replace(`/login?next=${encodeURIComponent("/workspace/account")}`);
    }
  }, [ready, session, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-steel">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-steel">
        Sign in optional for account settings…
      </div>
    );
  }

  return <>{children}</>;
}

export function ProjectWorkspaceLayout({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const { getProject, ready } = useWorkspace();
  const project = getProject(projectId);
  const router = useRouter();

  useEffect(() => {
    if (ready && !project) router.replace("/workspace");
  }, [ready, project, router]);

  if (!ready || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-steel">
        Loading project…
      </div>
    );
  }

  return (
    <WorkspaceShell projectId={project.id} projectName={project.name}>
      {children}
    </WorkspaceShell>
  );
}
