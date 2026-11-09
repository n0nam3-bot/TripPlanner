import { NextResponse } from "next/server";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { getDrivingRoute } from "@/lib/providers/serpapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const origin = typeof body.origin === "string" ? body.origin.trim().slice(0, 300) : "";
    const destination = typeof body.destination === "string" ? body.destination.trim().slice(0, 300) : "";
    if (!origin || !destination) return NextResponse.json({ error: "A starting point and destination are required." }, { status: 400 });
    const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const route = await getDrivingRoute(origin, destination, hashClientAddress(address));
    if (!route) return NextResponse.json({ error: "Google Maps did not return a driving route for these locations. You can still open the route directly in Maps." }, { status: 404 });
    return NextResponse.json(route, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Driving route lookup failed.";
    const rateLimited = ["SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_PROVIDER_QUOTA_LOW", "SERPAPI_PROVIDER_HOURLY_LIMIT", "SERPAPI_CLIENT_RATE_LIMITED"].includes(message);
    const unavailable = ["SERPAPI_NOT_CONFIGURED", "DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE", "SERPAPI_QUOTA_CHECK_FAILED"].includes(message);
    const safeMessage = message === "SERPAPI_NOT_CONFIGURED" ? "Driving directions require the SerpApi connection." : ["DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE"].includes(message) ? "Neon is required for safe caching and provider usage limits." : rateLimited ? "The travel-provider request limit has been reached. Try again after the limit resets." : message === "SERPAPI_QUOTA_CHECK_FAILED" ? "Tripfinder could not verify the provider balance, so it paused this route lookup." : "Driving route lookup failed. Open the destination in Maps instead.";
    return NextResponse.json({ error: safeMessage }, { status: unavailable ? 503 : rateLimited ? 429 : 502 });
  }
}
