/**
 * Reset MVP-unpaid pro/team profiles (stripe_customer_id IS NULL only).
 * Usage: node scripts/reset-mvp-unpaid-plans.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const DEFAULT_REF = "ngskcdocbabncgoclmks";
const dryRun = process.argv.includes("--dry-run");

function readWindowsCredUtf8(target) {
  if (process.platform !== "win32") return null;
  const ps1 = path.join(root, "scripts", "_read-supabase-cred.ps1");
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class SupabaseCredRead {
  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr credential);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr buffer);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public IntPtr TargetName; public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public int CredentialBlobSize;
    public IntPtr CredentialBlob; public int Persist; public int AttributeCount; public IntPtr Attributes;
    public IntPtr TargetAlias; public IntPtr UserName;
  }
  public static string ReadUtf8(string target) {
    IntPtr p; if (!CredRead(target, 1, 0, out p)) return null;
    var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
    byte[] bytes = new byte[c.CredentialBlobSize];
    Marshal.Copy(c.CredentialBlob, bytes, 0, c.CredentialBlobSize);
    CredFree(p); return Encoding.UTF8.GetString(bytes);
  }
}
"@
Write-Output ([SupabaseCredRead]::ReadUtf8('${target.replace(/'/g, "''")}'))
`.trim();
  try {
    fs.writeFileSync(ps1, script, "utf8");
    const out = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`,
      { encoding: "utf8" },
    ).trim();
    try {
      fs.unlinkSync(ps1);
    } catch {
      /* ignore */
    }
    return out || null;
  } catch {
    try {
      fs.unlinkSync(ps1);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function resolveToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }
  const fromCred = readWindowsCredUtf8("Supabase CLI:supabase");
  if (fromCred?.startsWith("sbp_")) return fromCred;
  console.error("No Supabase access token.");
  process.exit(1);
}

async function q(token, projectRef, query) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text;
}

const token = resolveToken();
const ref = process.env.SUPABASE_PROJECT_REF || DEFAULT_REF;

const before = await q(
  token,
  ref,
  `select left(user_id::text, 8) as user_prefix, plan, status
   from public.profiles
   where plan in ('pro','team') and stripe_customer_id is null`,
);
console.log("Candidates (no Stripe customer):\n", before);

if (dryRun) {
  console.log("Dry run — no update.");
  process.exit(0);
}

const result = await q(
  token,
  ref,
  `update public.profiles
   set plan = 'free', status = 'inactive', updated_at = now()
   where plan in ('pro', 'team') and stripe_customer_id is null
   returning left(user_id::text, 8) as user_prefix, plan, status`,
);
console.log("Reset:\n", result);

const after = await q(
  token,
  ref,
  `select plan, status, (stripe_customer_id is null) as no_stripe, count(*)::int as n
   from public.profiles group by 1,2,3 order by 1,2,3`,
);
console.log("Profiles summary after:\n", after);
