import { NextResponse } from "next/server";
import type { Deal } from "@/lib/types";
import {
  buildSharedPackagePayload,
  newShareToken,
} from "@/lib/shared-package";
import { saveSharedPackage, shareStorageMode } from "@/lib/package-store";
import { tryCreateServerClient } from "@/lib/supabase/server";
import { isBillingFreeMode } from "@/lib/billing/plans";
import { fetchOwnProfile, profileToEntitlement } from "@/lib/billing/profiles";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Soft server gate: share links are Pro when billing is enforced.
    // Free mode (default): any signed-in user; unauthenticated local store OK without Supabase.
    const freeMode = isBillingFreeMode();
    const supabase = await tryCreateServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (!freeMode) {
          const profile = await fetchOwnProfile(supabase, user.id);
          const { isPro } = profileToEntitlement(profile);
          if (!isPro) {
            return NextResponse.json(
              {
                error:
                  "Shareable bank package links require Pro. Upgrade at /pricing.",
                needsPro: true,
              },
              { status: 402 },
            );
          }
        }
      } else {
        return NextResponse.json(
          {
            error: freeMode
              ? "Sign in to create share links."
              : "Sign in and upgrade to Pro to create share links.",
            needsPro: !freeMode,
          },
          { status: 401 },
        );
      }
    } else {
      // No Supabase auth: allow local/dev share (file store) without Pro
      // only when cloud auth is not configured.
    }

    const body = (await request.json()) as { deal?: Deal };
    if (!body.deal || typeof body.deal.id !== "string") {
      return NextResponse.json(
        { error: "Missing deal payload" },
        { status: 400 },
      );
    }

    const token = newShareToken();
    const payload = buildSharedPackagePayload(body.deal);
    // Default: 90-day share links
    const expiresAt = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const result = await saveSharedPackage(token, payload, expiresAt);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          needsSupabase: result.needsSupabase ?? false,
          storageMode: shareStorageMode(),
        },
        { status: result.needsSupabase ? 503 : 500 },
      );
    }

    const origin = new URL(request.url).origin;
    const url = `${origin}/package/${token}`;

    return NextResponse.json({
      token,
      url,
      storage: result.storage,
      expiresAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create share link";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    storageMode: shareStorageMode(),
    ok: shareStorageMode() !== "none",
  });
}
