import { NextResponse } from "next/server";
import { loadSharedPackage } from "@/lib/package-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const payload = await loadSharedPackage(token);
  if (!payload) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }
  return NextResponse.json(payload);
}
