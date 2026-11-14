import { NextResponse } from "next/server";
import { recordProviderEvent } from "@/lib/db/travel-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = new Set(["tripfinder", "google_flights", "google_maps", "google_hotels", "booking_com", "viator", "getyourguide", "openstreetmap", "geoapify", "official_site", "other"]);
const CATEGORIES = new Set(["flights", "stays", "activities", "restaurants", "maps", "other"]);

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 2048) return NextResponse.json({ ok: false }, { status: 413 });
    const body: unknown = JSON.parse(rawBody);
    const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const eventType = input.eventType === "outbound_click" ? "outbound_click" : input.eventType === "result_selected" ? "result_selected" : null;
    const journeyId = typeof input.journeyId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.journeyId) ? input.journeyId : "";
    const provider = typeof input.provider === "string" && PROVIDERS.has(input.provider) ? input.provider : "other";
    const category = typeof input.category === "string" && CATEGORIES.has(input.category) ? input.category : "other";
    if (!eventType || !journeyId) return NextResponse.json({ ok: false }, { status: 400 });
    await recordProviderEvent({ provider, category, eventType, outcome: eventType === "result_selected" ? "selected" : "success", journeyId });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Analytics are deliberately best-effort; a telemetry failure never affects travel planning.
    return NextResponse.json({ ok: false }, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
}
