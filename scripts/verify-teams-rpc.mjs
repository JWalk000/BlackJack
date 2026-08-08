/**
 * Verify PostgREST knows create_team (not schema-cache miss).
 * Usage: node scripts/verify-teams-rpc.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ref = process.env.SUPABASE_PROJECT_REF || "ngskcdocbabncgoclmks";

function token() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  const ps1 = path.join(root, "scripts", "_read-cred-tmp.ps1");
  fs.writeFileSync(
    ps1,
    `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class CredV {
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
Write-Output ([CredV]::ReadUtf8('Supabase CLI:supabase'))
`.trim(),
  );
  try {
    return execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`, {
      encoding: "utf8",
    }).trim();
  } finally {
    try {
      fs.unlinkSync(ps1);
    } catch {
      /* ignore */
    }
  }
}

const t = token();
const keys = await (
  await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${t}` },
  })
).json();
const anon = keys.find((k) => k.name === "anon")?.api_key;
if (!anon) {
  console.error("no anon key", keys);
  process.exit(1);
}
const res = await fetch(`https://${ref}.supabase.co/rest/v1/rpc/create_team`, {
  method: "POST",
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ p_name: "probe" }),
});
const body = await res.text();
console.log(res.status, body.slice(0, 400));
if (/schema cache|could not find the function/i.test(body)) {
  console.error("FAIL: function still missing from PostgREST schema cache");
  process.exit(1);
}
if (res.status === 404) {
  console.error("FAIL: 404");
  process.exit(1);
}
console.log("OK: PostgREST exposes create_team(p_name)");
