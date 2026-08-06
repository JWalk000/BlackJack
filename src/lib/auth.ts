/** Client-side auth helpers (browser-local accounts until a server is added). */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function passwordIssues(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use letters and at least one number.";
  }
  return null;
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function createSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
}

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(digest);
}

export async function verifyPassword(
  password: string,
  salt: string,
  passwordHash: string,
): Promise<boolean> {
  const attempt = await hashPassword(password, salt);
  return attempt === passwordHash;
}

export function createSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
}

/** Default session length: 30 days */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
