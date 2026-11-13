import { NextResponse } from "next/server";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { geocodeGeoapifyStartingPoint } from "@/lib/providers/geoapify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 180) : "";
    const destination = typeof body.destination === "string" ? body.destination.trim().slice(0, 140) : "";
    if (query.length < 4 || !destination) return NextResponse.json({ error: "Enter a place or address within the searched destination." }, { status: 400 });
    const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const location = await geocodeGeoapifyStartingPoint({ query, destination, clientUsageKey: hashClientAddress(address) });
    if (!location) return NextResponse.json({ error: "Geoapify could not confidently identify that starting point. Add a street address or include the town and state." }, { status: 404 });
    return NextResponse.json(location, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Starting-point lookup failed.";
    const blocked = ["GEOAPIFY_DAILY_CAP_REACHED", "GEOAPIFY_CLIENT_DAILY_CAP_REACHED", "GEOAPIFY_DAILY_GATE_INCONSISTENT", "GEOAPIFY_CLIENT_GATE_INCONSISTENT", "GEOAPIFY_REQUEST_RATE_LIMITED", "GEOAPIFY_PROVIDER_RATE_LIMITED"].includes(message);
    const unavailable = ["GEOAPIFY_NOT_CONFIGURED", "DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE"].includes(message);
    const safeMessage = message === "GEOAPIFY_NOT_CONFIGURED"
      ? "Geoapify location lookup is not configured."
      : message.startsWith("GEOAPIFY_DAILY_CAP")
        ? "Tripfinder reached its shared Geoapify daily safety allowance. Try again after the UTC-day reset."
        : message.startsWith("GEOAPIFY_CLIENT_DAILY_CAP")
          ? "This browser reached its daily Geoapify safety allowance. Try again tomorrow."
          : message.includes("GATE_INCONSISTENT")
            ? "Tripfinder could not reserve a geocoding credit. The address was not sent; please retry shortly."
            : message.includes("RATE_LIMITED")
              ? "Location lookups are temporarily being spaced to protect the Geoapify request limit. Try again shortly."
              : unavailable
                ? "Tripfinder needs its database and Geoapify configuration to resolve a starting point."
                : "The starting point could not be resolved. Add a more complete address.";
    return NextResponse.json({ error: safeMessage }, { status: unavailable ? 503 : blocked ? 429 : 502 });
  }
}
