import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Shared-trip copies now remain local drafts until the traveler explicitly saves them. */
export async function POST() {
  return NextResponse.json({
    error: "Shared-trip copies are now prepared as unsaved drafts. Reload the shared link and choose Make my own copy again.",
    code: "FORK_NOW_LOCAL_DRAFT",
  }, { status: 410 });
}
