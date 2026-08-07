import { createServerClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRole,
  isSupabaseConfigured,
} from "./config";

export async function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error("Supabase is not configured");
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}

export function tryCreateServiceClient() {
  const env = getSupabasePublicEnv();
  const serviceKey = getSupabaseServiceRole();
  if (!env || !serviceKey) return null;
  return createSupabaseClient(env.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function tryCreateServerClient() {
  if (!isSupabaseConfigured()) return null;
  try {
    return await createClient();
  } catch {
    return null;
  }
}

function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim();
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  return token || null;
}

/**
 * Resolve the signed-in user for API routes.
 * Prefers `Authorization: Bearer <access_token>` (works even when cookies lag),
 * then falls back to Supabase session cookies.
 */
export async function resolveRequestAuth(request: Request): Promise<
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; status: number; error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      status: 503,
      error:
        "Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const env = getSupabasePublicEnv()!;
  const bearer = bearerFromRequest(request);

  if (bearer) {
    const supabase = createSupabaseClient(env.url, env.anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer);
    if (user && !error) {
      return { ok: true, supabase, user };
    }
  }

  const cookieClient = await tryCreateServerClient();
  if (!cookieClient) {
    return {
      ok: false,
      status: 503,
      error: "Auth is not configured (Supabase).",
    };
  }

  const {
    data: { user },
  } = await cookieClient.auth.getUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Sign in required to subscribe.",
    };
  }

  return { ok: true, supabase: cookieClient, user };
}
