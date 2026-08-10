import type { Deal } from "./types";
import { normalizeDeal } from "./deals";
import { tryCreateClient } from "./supabase/client";

export type CloudDealRow = {
  deal: Deal;
  userId: string;
  teamId: string | null;
};

function rowToDeal(row: {
  data: unknown;
  user_id: string;
  team_id?: string | null;
}): Deal | null {
  const deal = row.data as Deal | null | undefined;
  if (!deal || typeof deal.id !== "string") return null;
  return normalizeDeal({
    ...deal,
    teamId: row.team_id ?? deal.teamId ?? null,
    ownerUserId: row.user_id,
  });
}

/**
 * Fetch cloud deals the user can see:
 * - own rows (user_id = me)
 * - team-shared rows (team_id + membership via RLS)
 *
 * Free users with team membership still get team deals via RLS; callers
 * should only request cloud when user is signed in and either paid or has a team.
 */
export async function fetchCloudDeals(): Promise<Deal[]> {
  const rows = await fetchCloudDealRows();
  return rows.map((r) => r.deal);
}

export async function fetchCloudDealRows(): Promise<CloudDealRow[]> {
  const sb = tryCreateClient();
  if (!sb) return [];
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from("user_deals")
    .select("data, user_id, team_id, updated_at")
    .order("updated_at", { ascending: false });

  if (error || !data) {
    if (error) console.warn("[cloud-deals] fetch:", error.message);
    return [];
  }

  return (data as { data: unknown; user_id: string; team_id?: string | null }[])
    .map((row) => {
      const deal = rowToDeal(row);
      if (!deal) return null;
      return {
        deal,
        userId: row.user_id,
        teamId: row.team_id ?? null,
      } satisfies CloudDealRow;
    })
    .filter((r): r is CloudDealRow => r != null);
}

export async function fetchCloudDealById(id: string): Promise<Deal | null> {
  const sb = tryCreateClient();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from("user_deals")
    .select("data, user_id, team_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToDeal(
    data as { data: unknown; user_id: string; team_id?: string | null },
  );
}

export async function upsertCloudDeal(deal: Deal): Promise<{ error?: string }> {
  const sb = tryCreateClient();
  if (!sb) return { error: "Cloud not configured" };
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const updatedAt = deal.updatedAt || new Date().toISOString();
  const teamId = deal.teamId || null;

  // Preserve original owner on team deals we only co-edit
  let ownerId = user.id;
  if (deal.ownerUserId && deal.ownerUserId !== user.id && teamId) {
    ownerId = deal.ownerUserId;
  } else if (deal.ownerUserId && deal.ownerUserId === user.id) {
    ownerId = user.id;
  }

  // For co-edits of someone else's team deal, keep their user_id (RLS allows update)
  if (deal.ownerUserId && deal.ownerUserId !== user.id) {
    // Update path only — don't seize ownership
    const payload = {
      id: deal.id,
      user_id: deal.ownerUserId,
      team_id: teamId,
      data: {
        ...deal,
        updatedAt,
        teamId,
        ownerUserId: deal.ownerUserId,
      },
      updated_at: updatedAt,
    };
    const { error } = await sb.from("user_deals").upsert(payload, {
      onConflict: "id",
    });
    if (error) return { error: error.message };
    return {};
  }

  const { error } = await sb.from("user_deals").upsert(
    {
      id: deal.id,
      user_id: ownerId,
      team_id: teamId,
      data: {
        ...deal,
        updatedAt,
        teamId,
        ownerUserId: ownerId,
      },
      updated_at: updatedAt,
    },
    { onConflict: "id" },
  );
  if (error) return { error: error.message };
  return {};
}

export async function deleteCloudDeal(id: string): Promise<{ error?: string }> {
  const sb = tryCreateClient();
  if (!sb) return {};
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return {};
  const { error } = await sb
    .from("user_deals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}

/** Merge local + cloud by updatedAt (prefer newer). */
export function mergeDeals(local: Deal[], cloud: Deal[]): Deal[] {
  const map = new Map<string, Deal>();
  for (const d of local) map.set(d.id, d);
  for (const d of cloud) {
    const existing = map.get(d.id);
    if (!existing) {
      map.set(d.id, d);
      continue;
    }
    if ((d.updatedAt || "") > (existing.updatedAt || "")) {
      map.set(d.id, {
        ...d,
        // Keep owner/team metadata from cloud
        ownerUserId: d.ownerUserId ?? existing.ownerUserId,
        teamId: d.teamId ?? existing.teamId,
      });
    } else {
      map.set(d.id, {
        ...existing,
        ownerUserId: existing.ownerUserId ?? d.ownerUserId,
        teamId: existing.teamId ?? d.teamId,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || ""),
  );
}
