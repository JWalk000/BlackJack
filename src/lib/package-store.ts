import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  isSharedPackagePayload,
  type SharedPackagePayload,
} from "./shared-package";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRole,
  isSupabaseConfigured,
} from "./supabase/config";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function fileStoreDir(): string {
  // Local durable path; on Vercel without Supabase this is ephemeral (/tmp).
  if (process.env.VERCEL) {
    return path.join("/tmp", "estate-shared-packages");
  }
  return path.join(process.cwd(), "data", "shared");
}

function createAnonOrServiceClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  const key = getSupabaseServiceRole() || env.anonKey;
  return createSupabaseClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type StoreResult =
  | { ok: true; token: string; storage: "supabase" | "file" }
  | { ok: false; error: string; needsSupabase?: boolean };

export async function saveSharedPackage(
  token: string,
  payload: SharedPackagePayload,
  expiresAt?: string | null,
): Promise<StoreResult> {
  if (isSupabaseConfigured()) {
    const sb = createAnonOrServiceClient();
    if (!sb) {
      return { ok: false, error: "Supabase client unavailable" };
    }
    const { error } = await sb.from("shared_packages").insert({
      token,
      payload,
      expires_at: expiresAt ?? null,
    });
    if (error) {
      return {
        ok: false,
        error: error.message,
        needsSupabase: true,
      };
    }
    return { ok: true, token, storage: "supabase" };
  }

  // File fallback (local dev). On Vercel, warn that links are not durable.
  try {
    const dir = fileStoreDir();
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${token}.json`);
    await writeFile(
      filePath,
      JSON.stringify(
        {
          token,
          payload,
          created_at: new Date().toISOString(),
          expires_at: expiresAt ?? null,
        },
        null,
        2,
      ),
      "utf8",
    );
    return { ok: true, token, storage: "file" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "File store failed";
    return {
      ok: false,
      error: process.env.VERCEL
        ? "Cloud package storage requires Supabase. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        : msg,
      needsSupabase: Boolean(process.env.VERCEL),
    };
  }
}

export async function loadSharedPackage(
  token: string,
): Promise<SharedPackagePayload | null> {
  const clean = token.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean || clean !== token) return null;

  if (isSupabaseConfigured()) {
    const sb = createAnonOrServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("shared_packages")
        .select("payload, expires_at")
        .eq("token", clean)
        .maybeSingle();
      if (!error && data?.payload) {
        if (
          data.expires_at &&
          new Date(data.expires_at).getTime() < Date.now()
        ) {
          return null;
        }
        if (isSharedPackagePayload(data.payload)) return data.payload;
      }
    }
  }

  try {
    const filePath = path.join(fileStoreDir(), `${clean}.json`);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as {
      payload: unknown;
      expires_at?: string | null;
    };
    if (parsed.expires_at && new Date(parsed.expires_at).getTime() < Date.now()) {
      return null;
    }
    if (isSharedPackagePayload(parsed.payload)) return parsed.payload;
  } catch {
    // not found
  }

  return null;
}

export function shareStorageMode(): "supabase" | "file" | "none" {
  if (isSupabaseConfigured()) return "supabase";
  if (process.env.VERCEL) return "none";
  return "file";
}
