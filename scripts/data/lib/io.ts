import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";

export function cacheDir() {
  return path.join(process.cwd(), "data", "cache");
}

export function ensureCacheDir() {
  mkdirSync(cacheDir(), { recursive: true });
}

export function writeJson(name: string, data: unknown) {
  ensureCacheDir();
  const file = path.join(cacheDir(), name);
  writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return file;
}

export function readJson<T>(name: string): T | null {
  const file = path.join(cacheDir(), name);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export async function fetchText(
  url: string,
  opts?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "EstateDataPull/0.1 (+local free-data research)",
        Accept: "*/*",
        ...opts?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T>(
  url: string,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const text = await fetchText(url, opts);
  return JSON.parse(text) as T;
}
