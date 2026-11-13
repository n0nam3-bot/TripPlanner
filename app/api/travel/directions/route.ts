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
    const parseCoordinates = (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
      const item = value as Record<string, unknown>;
      const latitude = typeof item.latitude === "number" ? item.latitude : NaN;
      const longitude = typeof item.longitude === "number" ? item.longitude : NaN;
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return undefined;
      return { latitude, longitude };
    };
    const originCoordinates = parseCoordinates(body.originCoordinates);
    const destinationCoordinates = parseCoordinates(body.destinationCoordinates);
    const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const forceMapRefresh = body.forceMapRefresh === true;
    const route = await getDrivingRoute(origin, destination, hashClientAddress(address), { origin: originCoordinates, destination: destinationCoordinates }, { forceMapRefresh });
    if (!route) return NextResponse.json({ error: "The routing provider did not return a driving route for these locations. You can still open the route in Maps." }, { status: 404 });
    return NextResponse.json(route, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Driving route lookup failed.";
    const rateLimited = ["SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_PROVIDER_QUOTA_LOW", "SERPAPI_PROVIDER_HOURLY_LIMIT", "SERPAPI_CLIENT_RATE_LIMITED", "GEOAPIFY_DAILY_CAP_REACHED", "GEOAPIFY_CLIENT_DAILY_CAP_REACHED", "GEOAPIFY_DAILY_GATE_INCONSISTENT", "GEOAPIFY_CLIENT_GATE_INCONSISTENT", "GEOAPIFY_PROVIDER_RATE_LIMITED", "GEOAPIFY_REQUEST_RATE_LIMITED"].includes(message);
    const unavailable = ["SERPAPI_NOT_CONFIGURED", "GEOAPIFY_NOT_CONFIGURED", "DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE", "SERPAPI_QUOTA_CHECK_FAILED"].includes(message);
    const safeMessage = message === "SERPAPI_NOT_CONFIGURED" ? "Driving directions require SerpApi when coordinates are unavailable." : message === "GEOAPIFY_NOT_CONFIGURED" ? "Geoapify routing is not configured." : ["DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE"].includes(message) ? "Neon is required for safe caching and provider usage limits." : message === "GEOAPIFY_DAILY_CAP_REACHED" ? "Tripfinder reached its shared Geoapify daily credit safety limit. Try again after the UTC-day reset." : message === "GEOAPIFY_CLIENT_DAILY_CAP_REACHED" ? "This connection reached its daily Geoapify credit limit. Try again tomorrow." : ["GEOAPIFY_DAILY_GATE_INCONSISTENT", "GEOAPIFY_CLIENT_GATE_INCONSISTENT"].includes(message) ? "Tripfinder could not reserve Geoapify credits consistently even though the displayed usage may be below its cap. The map request was not sent; retry shortly." : message === "GEOAPIFY_REQUEST_RATE_LIMITED" ? "Tripfinder is protecting the shared Geoapify request rate. Try again shortly." : rateLimited ? "The travel-provider request limit has been reached. Try again after the limit resets." : message === "SERPAPI_QUOTA_CHECK_FAILED" ? "Tripfinder could not verify the provider balance, so it paused this route lookup." : "Driving route lookup failed. Open the destination in Maps instead.";
    return NextResponse.json({ error: safeMessage }, { status: unavailable ? 503 : rateLimited ? 429 : 502 });
  }
}
