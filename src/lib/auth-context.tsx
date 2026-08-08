"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabase/config";
import { tryCreateClient } from "./supabase/client";
import { claimTeamInvites } from "./teams";

type AuthContextValue = {
  cloudReady: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cloudReady = isSupabaseConfigured();
  const [loading, setLoading] = useState(cloudReady);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!cloudReady) {
      setLoading(false);
      return;
    }

    const sb = tryCreateClient();
    if (!sb) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const apply = (next: Session | null) => {
      if (!mounted) return;
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
      // Attach pending team invites matching this email.
      if (next?.user) {
        void claimTeamInvites(sb);
      }
    };

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(
      (_event: AuthChangeEvent, next: Session | null) => {
        apply(next);
      },
    );

    void sb.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        apply(data.session);
      })
      .catch(() => {
        apply(null);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [cloudReady]);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = tryCreateClient();
    if (!sb) return { error: "Cloud auth is not configured." };
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    setSession(data.session);
    setUser(data.user ?? data.session?.user ?? null);
    setLoading(false);
    if (data.session?.user) void claimTeamInvites(sb);
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = tryCreateClient();
    if (!sb) return { error: "Cloud auth is not configured." };
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      setLoading(false);
      void claimTeamInvites(sb);
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    const sb = tryCreateClient();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      cloudReady,
      loading,
      user,
      session,
      signIn,
      signUp,
      signOut,
    }),
    [cloudReady, loading, user, session, signIn, signUp, signOut],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
