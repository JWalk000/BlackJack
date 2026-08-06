"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createSalt,
  createSessionToken,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  passwordIssues,
  SESSION_MS,
  verifyPassword,
} from "@/lib/auth";
import { uid } from "@/lib/id";
import { claimGuestProjects, storage } from "@/lib/storage";
import type { Session, User } from "@/lib/types";

type AuthResult = { ok: true } | { ok: false; error: string };

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<AuthResult>;
  signIn: (input: {
    email: string;
    password: string;
  }) => Promise<AuthResult>;
  signOut: () => void;
  updateProfile: (input: { name: string }) => Promise<AuthResult>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionValid(session: Session | null): session is Session {
  if (!session?.userId || !session.email) return false;
  if (!session.expiresAt) return true; // legacy session
  return new Date(session.expiresAt).getTime() > Date.now();
}

function buildSession(user: User): Session {
  const now = Date.now();
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    token: createSessionToken(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_MS).toISOString(),
  };
}

async function ensureHashedUser(
  user: User,
  plainPassword: string,
): Promise<User> {
  if (user.passwordHash && user.salt) return user;
  // Migrate legacy plaintext password rows
  const salt = createSalt();
  const passwordHash = await hashPassword(plainPassword, salt);
  const next: User = {
    ...user,
    salt,
    passwordHash,
    password: undefined,
    updatedAt: new Date().toISOString(),
  };
  const users = storage.getUsers().map((u) => (u.id === user.id ? next : u));
  storage.saveUsers(users);
  return next;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const stored = storage.getSession();
    if (sessionValid(stored)) {
      // Refresh display name from user record if available
      const user = storage.getUsers().find((u) => u.id === stored.userId);
      if (user) {
        setSession({
          ...stored,
          name: user.name,
          email: user.email,
        });
      } else {
        storage.setSession(null);
        setSession(null);
      }
    } else if (stored) {
      storage.setSession(null);
      setSession(null);
    }
    setReady(true);
  }, []);

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
    }): Promise<AuthResult> => {
      const email = normalizeEmail(input.email);
      const name = input.name.trim();
      if (!name) {
        return { ok: false, error: "Enter your name." };
      }
      if (!isValidEmail(email)) {
        return { ok: false, error: "Enter a valid email address." };
      }
      const pwError = passwordIssues(input.password);
      if (pwError) return { ok: false, error: pwError };

      const users = storage.getUsers();
      if (users.some((u) => u.email === email)) {
        return {
          ok: false,
          error: "An account with that email already exists. Sign in instead.",
        };
      }

      const salt = createSalt();
      const passwordHash = await hashPassword(input.password, salt);
      const now = new Date().toISOString();
      const user: User = {
        id: uid("user"),
        name,
        email,
        salt,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      };
      storage.saveUsers([...users, user]);
      claimGuestProjects(user.id);
      const next = buildSession(user);
      storage.setSession(next);
      setSession(next);
      return { ok: true };
    },
    [],
  );

  const signIn = useCallback(
    async (input: {
      email: string;
      password: string;
    }): Promise<AuthResult> => {
      const email = normalizeEmail(input.email);
      if (!isValidEmail(email)) {
        return { ok: false, error: "Enter a valid email address." };
      }
      if (!input.password) {
        return { ok: false, error: "Enter your password." };
      }

      const users = storage.getUsers();
      const user = users.find((u) => u.email === email);
      if (!user) {
        return { ok: false, error: "Invalid email or password." };
      }

      let ok = false;
      if (user.passwordHash && user.salt) {
        ok = await verifyPassword(
          input.password,
          user.salt,
          user.passwordHash,
        );
      } else if (user.password && user.password === input.password) {
        ok = true;
        await ensureHashedUser(user, input.password);
      }

      if (!ok) {
        return { ok: false, error: "Invalid email or password." };
      }

      const fresh =
        storage.getUsers().find((u) => u.id === user.id) ?? user;
      claimGuestProjects(fresh.id);
      const next = buildSession(fresh);
      storage.setSession(next);
      setSession(next);
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(() => {
    storage.setSession(null);
    setSession(null);
  }, []);

  const updateProfile = useCallback(
    async (input: { name: string }): Promise<AuthResult> => {
      if (!session) return { ok: false, error: "You are not signed in." };
      const name = input.name.trim();
      if (!name) return { ok: false, error: "Enter your name." };

      const users = storage.getUsers();
      const idx = users.findIndex((u) => u.id === session.userId);
      if (idx < 0) return { ok: false, error: "Account not found." };

      const nextUser: User = {
        ...users[idx],
        name,
        updatedAt: new Date().toISOString(),
      };
      const nextUsers = [...users];
      nextUsers[idx] = nextUser;
      storage.saveUsers(nextUsers);

      const nextSession: Session = { ...session, name };
      storage.setSession(nextSession);
      setSession(nextSession);
      return { ok: true };
    },
    [session],
  );

  const changePassword = useCallback(
    async (input: {
      currentPassword: string;
      newPassword: string;
    }): Promise<AuthResult> => {
      if (!session) return { ok: false, error: "You are not signed in." };
      const pwError = passwordIssues(input.newPassword);
      if (pwError) return { ok: false, error: pwError };

      const users = storage.getUsers();
      const user = users.find((u) => u.id === session.userId);
      if (!user) return { ok: false, error: "Account not found." };

      let currentOk = false;
      if (user.passwordHash && user.salt) {
        currentOk = await verifyPassword(
          input.currentPassword,
          user.salt,
          user.passwordHash,
        );
      } else if (user.password) {
        currentOk = user.password === input.currentPassword;
      }
      if (!currentOk) {
        return { ok: false, error: "Current password is incorrect." };
      }

      const salt = createSalt();
      const passwordHash = await hashPassword(input.newPassword, salt);
      const nextUser: User = {
        ...user,
        salt,
        passwordHash,
        password: undefined,
        updatedAt: new Date().toISOString(),
      };
      storage.saveUsers(
        users.map((u) => (u.id === user.id ? nextUser : u)),
      );
      return { ok: true };
    },
    [session],
  );

  const value = useMemo(
    () => ({
      ready,
      session,
      signUp,
      signIn,
      signOut,
      updateProfile,
      changePassword,
    }),
    [
      ready,
      session,
      signUp,
      signIn,
      signOut,
      updateProfile,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
