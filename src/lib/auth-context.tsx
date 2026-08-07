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
import { normalizePhone } from "./contact";
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
  /** Send SMS OTP (requires Phone provider enabled in Supabase). */
  sendPhoneOtp: (phone: string) => Promise<{ error?: string }>;
  /** Verify SMS OTP and establish session. */
  verifyPhoneOtp: (
    phone: string,
    token: string,
  ) => Promise<{ error?: string }>;
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
      // Attach pending team invites matching this email or phone.
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

  const sendPhoneOtp = useCallback(async (phone: string) => {
    const sb = tryCreateClient();
    if (!sb) return { error: "Cloud auth is not configured." };
    const e164 = normalizePhone(phone);
    if (!e164) {
      return {
        error:
          "Enter a valid phone (US 10-digit or international +E.164, e.g. +15551234567).",
      };
    }
    const { error } = await sb.auth.signInWithOtp({ phone: e164 });
    if (error) return { error: error.message };
    return {};
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    const sb = tryCreateClient();
    if (!sb) return { error: "Cloud auth is not configured." };
    const e164 = normalizePhone(phone);
    if (!e164) {
      return { error: "Enter a valid phone number." };
    }
    const code = token.trim();
    if (!code) return { error: "Enter the code from your SMS." };

    const { data, error } = await sb.auth.verifyOtp({
      phone: e164,
      token: code,
      type: "sms",
    });
    if (error) return { error: error.message };
    setSession(data.session);
    setUser(data.user ?? data.session?.user ?? null);
    setLoading(false);
    if (data.session?.user) void claimTeamInvites(sb);
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
      sendPhoneOtp,
      verifyPhoneOtp,
      signOut,
    }),
    [
      cloudReady,
      loading,
      user,
      session,
      signIn,
      signUp,
      sendPhoneOtp,
      verifyPhoneOtp,
      signOut,
    ],
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
