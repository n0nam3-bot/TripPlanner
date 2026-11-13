import { NextRequest, NextResponse } from "next/server";
import { discardUnmodifiedSavedTripFork } from "@/lib/db/saved-trips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientAddress(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return (forwarded || real || "unknown-client").slice(0, 120);
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ deleted: false }, { status: 200 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2 * 1024) return NextResponse.json({ error: "The cleanup request was too large." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The cleanup request was not valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ deleted: false }, { status: 400 });
  const record = body as Record<string, unknown>;
  const sourceShareToken = record.sourceShareToken;
  const shareToken = record.shareToken;
  const ownerToken = record.ownerToken;
  if (![sourceShareToken, shareToken, ownerToken].every((value) => typeof value === "string" && /^[A-Za-z0-9_-]{40,48}$/.test(value))) {
    return NextResponse.json({ deleted: false }, { status: 400 });
  }
  try {
    const deleted = await discardUnmodifiedSavedTripFork(sourceShareToken as string, shareToken as string, ownerToken as string, { clientAddress: clientAddress(request) });
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("Tripfinder could not clean an abandoned legacy copy.", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ deleted: false }, { status: 200 });
  }
}
