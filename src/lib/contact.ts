/**
 * Contact normalization for team invites + auth.
 * Keep in sync with public.normalize_phone / normalize_email in teams.sql.
 */

export function normalizeEmail(email: string): string | null {
  const v = email.trim().toLowerCase();
  if (!v || !v.includes("@")) return null;
  return v;
}

/**
 * Normalize to E.164 when possible.
 * - 10 digits → +1… (US default)
 * - 11 digits starting with 1 → +…
 * - already international (+… or longer digit string) → +digits
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

export function looksLikeEmail(raw: string): boolean {
  return raw.trim().includes("@");
}

export function looksLikePhone(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 10 && !raw.trim().includes("@");
}

/** Format for display (keeps E.164 or raw). */
export function displayContact(opts: {
  email?: string | null;
  phone?: string | null;
}): string {
  const parts = [opts.email, opts.phone].filter(Boolean);
  return parts.join(" · ") || "—";
}
