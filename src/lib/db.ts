/**
 * Optional Postgres access for the app.
 * If DATABASE_URL is missing, returns null and callers should use sample data.
 */
import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool() {
  if (!isDbConfigured()) return null;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function queryDb<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  const p = getPool();
  if (!p) return null;
  const result = await p.query<T>(text, params);
  return result.rows;
}
