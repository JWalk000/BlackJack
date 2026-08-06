import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import pg from "pg";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const { Pool } = pg;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

export function hasDatabase() {
  return Boolean(getDatabaseUrl());
}

export function createPool() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example → .env.local and start Docker Postgres.",
    );
  }
  return new Pool({ connectionString: url });
}

export async function applySchema(pool: pg.Pool) {
  const schemaPath = resolve(process.cwd(), "db/schema.sql");
  if (!existsSync(schemaPath)) {
    throw new Error(`Missing schema at ${schemaPath}`);
  }
  const sql = readFileSync(schemaPath, "utf8");
  await pool.query(sql);
}
