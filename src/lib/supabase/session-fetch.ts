import { tryCreateClient } from "./client";

/** Authorization header from the browser session for API Route Handlers. */
export async function getSessionAuthHeaders(): Promise<HeadersInit> {
  const sb = tryCreateClient();
  if (!sb) return {};
  try {
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  } catch {
    return {};
  }
}

export async function parseApiJson<T extends { error?: string }>(
  res: Response,
): Promise<T & { parseError?: string }> {
  const text = await res.text();
  if (!text) {
    return {
      parseError: res.ok
        ? "Empty response from server."
        : `Request failed (${res.status}).`,
    } as T & { parseError?: string };
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      parseError: `Unexpected response (${res.status}).`,
    } as T & { parseError?: string };
  }
}
