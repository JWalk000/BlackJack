/** Canonical production origin for sitemap, robots, and metadata. */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "https://www.estatearc.net";
}
