import { NextRequest, NextResponse } from "next/server";
import { saveAnonymousTripDraft } from "@/lib/db/saved-trips";
import { validateSavedTripDraft } from "@/lib/trip-planner/saved-trips";
import { ANONYMOUS_VISITOR_COOKIE, ANONYMOUS_VISITOR_COOKIE_MAX_AGE, createAnonymousVisitorId, isValidAnonymousVisitorId } from "@/lib/trip-planner/anonymous-visitor";

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
  const existingVisitorId = request.cookies.get(ANONYMOUS_VISITOR_COOKIE)?.value;
  const visitorId = isValidAnonymousVisitorId(existingVisitorId) ? existingVisitorId : createAnonymousVisitorId();
  const needsVisitorCookie = visitorId !== existingVisitorId;
  const withVisitorCookie = (response: NextResponse) => {
    if (needsVisitorCookie) response.cookies.set(ANONYMOUS_VISITOR_COOKIE, visitorId, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
      maxAge: ANONYMOUS_VISITOR_COOKIE_MAX_AGE,
    });
    return response;
  };
  try {
    const saved = await saveAnonymousTripDraft(validation.draft, { shareToken, ownerToken, visitorId, clientAddress: clientAddress(request) });
    const baseUrl = canonicalBaseUrl(request);
    return withVisitorCookie(NextResponse.json({
      success: true,
      shareToken: saved.shareToken,
      ...(saved.ownerToken ? { ownerToken: saved.ownerToken } : {}),
      shareUrl: `${baseUrl}/trip/${saved.shareToken}`,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      expiresAt: saved.expiresAt,
      updated: Boolean(shareToken),
    }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "SAVED_TRIP_SAVE_FAILED";
    if (code === "SAVED_TRIP_VISITOR_DAILY_LIMIT") return withVisitorCookie(NextResponse.json({ error: "This browser has reached today's limit of 5 new saved trips. Existing trips, shared links, copies and searches remain available. Try again after the UTC daily reset." }, { status: 429 }));
    if (code === "SAVED_TRIP_IP_ABUSE_LIMIT") return withVisitorCookie(NextResponse.json({ error: "This network has reached Tripfinder's daily safety limit for new saved trips. Existing trips, shared links, copies and searches remain available. Try again after the UTC daily reset." }, { status: 429 }));
    if (code === "SAVED_TRIP_OWNER_TOKEN_REQUIRED" || code === "SAVED_TRIP_NOT_FOUND_OR_NOT_OWNER") return NextResponse.json({ error: "This saved trip could not be updated from this browser. Create a new shareable copy instead." }, { status: 403 });
    if (code === "SAVED_TRIP_TOO_LARGE") return withVisitorCookie(NextResponse.json({ error: "This trip is too large to save. Remove some selected items and try again." }, { status: 413 }));
    console.error("Tripfinder could not save an anonymous trip draft.", code);
    return withVisitorCookie(NextResponse.json({ error: "Tripfinder couldn't confirm this save. A rejected database insert does not consume your daily allowance; if the connection was interrupted, the save may still have completed. Please check before retrying." }, { status: 503 }));
  }
}
