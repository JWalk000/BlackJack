import type { SupabaseClient } from "@supabase/supabase-js";
import { TEAM_SEAT_LIMIT } from "./billing/plans";
import {
  displayContact,
  looksLikeEmail,
  normalizeEmail,
} from "./contact";
import { tryCreateClient } from "./supabase/client";

export type TeamRole = "owner" | "member";

export type TeamRow = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
};

export type TeamMemberRow = {
  id: string;
  team_id: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  role: TeamRole;
  invited_at: string;
  joined_at: string | null;
};

export type MyTeam = {
  team: TeamRow;
  members: TeamMemberRow[];
  /** True when the signed-in user created the team. */
  isOwner: boolean;
};

export { normalizeEmail, normalizePhone, displayContact };

/** Map PostgREST/schema-cache errors to actionable messages. */
export function mapTeamRpcError(message: string): string {
  const m = message || "Unknown error";
  if (
    /schema cache|could not find the function/i.test(m) ||
    /does not exist/i.test(m)
  ) {
    return (
      "Teams database is not migrated. In Supabase → SQL Editor, run the full file " +
      "supabase/teams.sql (after schema.sql). Then retry Create team."
    );
  }
  if (/Team plan required/i.test(m)) {
    return "Subscribe to Team ($35/mo) on Pricing first, then create your team.";
  }
  if (/not authenticated|jwt/i.test(m)) {
    return "Sign in again, then create or join a team.";
  }
  return m;
}

/** Attach pending invites that match the signed-in user's email or phone. */
export async function claimTeamInvites(
  sb?: SupabaseClient | null,
): Promise<number> {
  const client = sb ?? tryCreateClient();
  if (!client) return 0;
  const { data, error } = await client.rpc("claim_team_invites");
  if (error) {
    console.warn("[teams] claim_team_invites:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export async function fetchMyTeam(
  userId: string,
  sb?: SupabaseClient | null,
): Promise<MyTeam | null> {
  const client = sb ?? tryCreateClient();
  if (!client) return null;

  const { data: membership, error: memErr } = await client
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (memErr || !membership) {
    if (memErr) console.warn("[teams] membership:", memErr.message);
    return null;
  }

  const teamId = (membership as { team_id: string }).team_id;

  const { data: team, error: teamErr } = await client
    .from("teams")
    .select("id, name, owner_user_id, created_at")
    .eq("id", teamId)
    .maybeSingle();

  if (teamErr || !team) {
    if (teamErr) console.warn("[teams] team fetch:", teamErr.message);
    return null;
  }

  const { data: members, error: listErr } = await client
    .from("team_members")
    .select("id, team_id, user_id, email, phone, role, invited_at, joined_at")
    .eq("team_id", teamId)
    .order("invited_at", { ascending: true });

  if (listErr) {
    console.warn("[teams] members:", listErr.message);
  }

  const row = team as TeamRow;
  return {
    team: row,
    members: (members as TeamMemberRow[] | null) ?? [],
    isOwner: row.owner_user_id === userId,
  };
}

export async function createTeam(
  name: string,
): Promise<{ teamId?: string; error?: string }> {
  const sb = tryCreateClient();
  if (!sb) return { error: "Cloud not configured" };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Team name required" };

  const { data, error } = await sb.rpc("create_team", { p_name: trimmed });
  if (error) return { error: mapTeamRpcError(error.message) };
  return { teamId: data as string };
}

/**
 * Invite by email only. Teammate claims seat when they sign in with that email.
 */
export async function inviteTeamMember(
  teamId: string,
  contactOrEmail: string,
): Promise<{ memberId?: string; error?: string }> {
  const sb = tryCreateClient();
  if (!sb) return { error: "Cloud not configured" };

  const email = normalizeEmail(contactOrEmail);
  if (!email || !looksLikeEmail(contactOrEmail.trim())) {
    return { error: "Enter a valid email address" };
  }

  const { data, error } = await sb.rpc("invite_team_member", {
    p_team_id: teamId,
    p_email: email,
    p_phone: null,
  });
  if (error) return { error: mapTeamRpcError(error.message) };
  return { memberId: data as string };
}

export async function removeTeamMember(
  memberId: string,
): Promise<{ error?: string }> {
  const sb = tryCreateClient();
  if (!sb) return { error: "Cloud not configured" };
  const { error } = await sb.rpc("remove_team_member", {
    p_member_id: memberId,
  });
  if (error) return { error: mapTeamRpcError(error.message) };
  return {};
}

export function seatsRemaining(memberCount: number): number {
  return Math.max(0, TEAM_SEAT_LIMIT - memberCount);
}

export function memberLabel(m: Pick<TeamMemberRow, "email" | "phone">): string {
  return displayContact({ email: m.email, phone: m.phone ?? null });
}
