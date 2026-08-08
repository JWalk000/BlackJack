/**
 * One-time: apply supabase/schema.sql + supabase/teams.sql to remote Supabase
 * via Management API (requires Supabase CLI login / sbp_ PAT).
 *
 * Usage:
 *   node scripts/apply-teams-sql.mjs
 *   node scripts/apply-teams-sql.mjs --project-ref ngskcdocbabncgoclmks
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-teams-sql.mjs
 *
 * Does not expose a public HTTP endpoint — run locally or in CI only.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DEFAULT_REF = "ngskcdocbabncgoclmks"; // JWalk000's Estate

function parseArgs(argv) {
  let projectRef = process.env.SUPABASE_PROJECT_REF || DEFAULT_REF;
  let schemaOnly = false;
  let teamsOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project-ref" && argv[i + 1]) {
      projectRef = argv[++i];
    } else if (argv[i] === "--schema-only") {
      schemaOnly = true;
    } else if (argv[i] === "--teams-only") {
      teamsOnly = true;
    }
  }
  return { projectRef, schemaOnly, teamsOnly };
}

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
  console.error(
    "No Supabase access token. Run `npx supabase login` or set SUPABASE_ACCESS_TOKEN.",
  );
  process.exit(1);
}

async function runQuery(token, projectRef, query, label) {
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
  if (!res.ok) {
    console.error(`FAIL ${label} HTTP ${res.status}:\n${text.slice(0, 2000)}`);
    throw new Error(`${label} failed`);
  }
  console.log(`OK ${label} (${res.status}) ${text.slice(0, 500)}`);
  return text;
}

async function main() {
  const { projectRef, schemaOnly, teamsOnly } = parseArgs(process.argv.slice(2));
  const token = resolveToken();
  console.log(`Project ref: ${projectRef}`);

  const schemaPath = path.join(root, "supabase", "schema.sql");
  const teamsPath = path.join(root, "supabase", "teams.sql");

  if (!teamsOnly) {
    const schema = fs.readFileSync(schemaPath, "utf8");
    await runQuery(token, projectRef, schema, "schema.sql");
  }
  if (!schemaOnly) {
    const teams = fs.readFileSync(teamsPath, "utf8");
    await runQuery(token, projectRef, teams, "teams.sql");
  }

  await runQuery(
    token,
    projectRef,
    `select p.proname, pg_get_function_identity_arguments(p.oid) as args
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'create_team','invite_team_member','claim_team_invites',
         'remove_team_member','is_team_member','is_team_owner'
       )
     order by 1, 2;`,
    "verify-functions",
  );

  await runQuery(
    token,
    projectRef,
    `select tablename from pg_tables where schemaname = 'public' order by 1;`,
    "verify-tables",
  );

  await runQuery(
    token,
    projectRef,
    `select column_name, data_type
     from information_schema.columns
     where table_schema = 'public' and table_name = 'user_deals' and column_name = 'team_id';`,
    "verify-user_deals.team_id",
  );

  // Notify PostgREST to reload schema cache (optional; redeploy/restart also works)
  try {
    await runQuery(
      token,
      projectRef,
      `notify pgrst, 'reload schema';`,
      "reload-postgrest-schema",
    );
  } catch (e) {
    console.warn("Schema reload notify skipped:", e.message);
  }

  console.log("\nDone. create_team / invite / claim / share-deal RLS should be live.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
