import { NextRequest, NextResponse } from "next/server";
import { saveAnonymousTripDraft } from "@/lib/db/saved-trips";
import { validateSavedTripDraft } from "@/lib/trip-planner/saved-trips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canonicalBaseUrl(request: NextRequest): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.startsWith("http") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) return `https://${productionHost}`;
  return request.nextUrl.origin;
}

function clientAddress(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return (forwarded || real || "unknown-client").slice(0, 120);
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Trip saving is temporarily unavailable because the database is not configured." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 140 * 1024) return NextResponse.json({ error: "This trip is too large to save. Remove a few selected items and try again." }, { status: 413 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The save request was not valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Trip details are required." }, { status: 400 });
  const record = body as Record<string, unknown>;
  const validation = validateSavedTripDraft(record);
  if (!validation.draft) return NextResponse.json({ error: validation.errors[0] || "Trip details could not be validated." }, { status: 400 });

  const shareToken = typeof record.shareToken === "string" ? record.shareToken : undefined;
  const ownerToken = typeof record.ownerToken === "string" ? record.ownerToken : undefined;
  try {
    const saved = await saveAnonymousTripDraft(validation.draft, { shareToken, ownerToken, clientAddress: clientAddress(request) });
    const baseUrl = canonicalBaseUrl(request);
    return NextResponse.json({
      success: true,
      shareToken: saved.shareToken,
      ...(saved.ownerToken ? { ownerToken: saved.ownerToken } : {}),
      shareUrl: `${baseUrl}/trip/${saved.shareToken}`,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      expiresAt: saved.expiresAt,
      updated: Boolean(shareToken),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SAVED_TRIP_SAVE_FAILED";
    if (code === "SAVED_TRIP_DAILY_LIMIT") return NextResponse.json({ error: "This connection has reached today's saved-trip limit. Try again tomorrow." }, { status: 429 });
    if (code === "SAVED_TRIP_OWNER_TOKEN_REQUIRED" || code === "SAVED_TRIP_NOT_FOUND_OR_NOT_OWNER") return NextResponse.json({ error: "This saved trip could not be updated from this browser. Create a new shareable copy instead." }, { status: 403 });
    if (code === "SAVED_TRIP_TOO_LARGE") return NextResponse.json({ error: "This trip is too large to save. Remove some selected items and try again." }, { status: 413 });
    console.error("Tripfinder could not save an anonymous trip draft.", code);
    return NextResponse.json({ error: "Tripfinder couldn't save this trip right now. Please try again." }, { status: 503 });
  }
}
