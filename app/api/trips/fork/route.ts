import { NextRequest, NextResponse } from "next/server";
import { forkSavedTripFromShareToken } from "@/lib/db/saved-trips";

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
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Making a trip copy is temporarily unavailable because the database is not configured." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2 * 1024) return NextResponse.json({ error: "The copy request was too large." }, { status: 413 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The copy request was not valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "A shared trip link is required." }, { status: 400 });
  const sourceShareToken = (body as Record<string, unknown>).sourceShareToken;
  if (typeof sourceShareToken !== "string" || !/^[A-Za-z0-9_-]{40,48}$/.test(sourceShareToken)) {
    return NextResponse.json({ error: "This shared trip link is invalid or has expired." }, { status: 404 });
  }

  try {
    const saved = await forkSavedTripFromShareToken(sourceShareToken, { clientAddress: clientAddress(request) });
    const baseUrl = canonicalBaseUrl(request);
    return NextResponse.json({
      success: true,
      shareToken: saved.shareToken,
      ownerToken: saved.ownerToken,
      shareUrl: `${baseUrl}/trip/${saved.shareToken}`,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      expiresAt: saved.expiresAt,
    }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SAVED_TRIP_FORK_FAILED";
    if (code === "SAVED_TRIP_SOURCE_NOT_FOUND") return NextResponse.json({ error: "This shared trip could not be found or has expired." }, { status: 404 });
    if (code === "SAVED_TRIP_DAILY_LIMIT") return NextResponse.json({ error: "This connection has reached today's saved-trip limit. Try again tomorrow." }, { status: 429 });
    if (code === "SAVED_TRIP_TOO_LARGE") return NextResponse.json({ error: "This trip is too large to copy." }, { status: 413 });
    console.error("Tripfinder could not fork a shared trip.", code);
    return NextResponse.json({ error: "Tripfinder couldn't create your copy right now. Please try again." }, { status: 503 });
  }
}
