import type { Project, Session, User } from "./types";
import { uid } from "./id";

const USERS_KEY = "estate.users";
const SESSION_KEY = "estate.session";
const PROJECTS_KEY = "estate.projects";
const GUEST_KEY = "estate.guestId";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

/** Stable anonymous owner id for this browser (no login required). */
export function getGuestId(): string {
  if (typeof window === "undefined") return "guest-ssr";
  const existing = localStorage.getItem(GUEST_KEY);
  if (existing) return existing;
  const id = uid("guest");
  localStorage.setItem(GUEST_KEY, id);
  return id;
}

/** Active project owner: signed-in user or guest. */
export function getLocalOwnerId(session: Session | null | undefined): string {
  if (session?.userId) return session.userId;
  return getGuestId();
}

/** Move guest-owned projects onto a user account after sign-in / sign-up. */
export function claimGuestProjects(userId: string): void {
  if (typeof window === "undefined") return;
  const guestId = localStorage.getItem(GUEST_KEY);
  if (!guestId || guestId === userId) return;
  const projects = read<Project[]>(PROJECTS_KEY, []);
  const next = projects.map((p) =>
    p.ownerId === guestId
      ? { ...p, ownerId: userId, updatedAt: new Date().toISOString() }
      : p,
  );
  write(PROJECTS_KEY, next);
}

export const storage = {
  getUsers(): User[] {
    return read<User[]>(USERS_KEY, []);
  },
  saveUsers(users: User[]) {
    write(USERS_KEY, users);
  },
  getSession(): Session | null {
    return read<Session | null>(SESSION_KEY, null);
  },
  setSession(session: Session | null) {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    write(SESSION_KEY, session);
  },
  getProjects(): Project[] {
    return read<Project[]>(PROJECTS_KEY, []);
  },
  saveProjects(projects: Project[]) {
    write(PROJECTS_KEY, projects);
  },
};
