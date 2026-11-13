import { NextResponse } from "next/server";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { getFlightBookingOptions } from "@/lib/providers/serpapi";
import { validateTripSearchInput } from "@/lib/trip-planner/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const body = rawBody && typeof rawBody === "object" ? rawBody as Record<string, unknown> : {};
    if (typeof body.bookingToken !== "string" || !body.bookingToken.trim()) {
      return NextResponse.json({ error: "A valid flight selection is required." }, { status: 400 });
    }
    const validated = validateTripSearchInput(body.search);
    if (!validated.input) return NextResponse.json({ error: "Original trip details are required for seller lookup.", details: validated.errors }, { status: 400 });
    const destinationAirportCode = typeof body.destinationAirportCode === "string" ? body.destinationAirportCode.toUpperCase() : "";
    if (!/^[A-Z]{3}$/.test(destinationAirportCode)) return NextResponse.json({ error: "A valid destination airport code is required." }, { status: 400 });
    const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const result = await getFlightBookingOptions(body.bookingToken, validated.input, destinationAirportCode, hashClientAddress(address), body.forceRefresh === true);
    return NextResponse.json({ options: result.offers, checkedAt: result.checkedAt, dataAsOf: result.dataAsOf, servedFromCache: result.servedFromCache, stale: result.stale }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve booking options.";
    const status = ["SERPAPI_NOT_CONFIGURED", "DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE", "SERPAPI_QUOTA_CHECK_FAILED"].includes(message) ? 503 : message === "INVALID_BOOKING_TOKEN" ? 400 : ["SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_PROVIDER_QUOTA_LOW", "SERPAPI_PROVIDER_HOURLY_LIMIT", "SERPAPI_CLIENT_RATE_LIMITED"].includes(message) ? 429 : 502;
    const safeMessage = message === "SERPAPI_NOT_CONFIGURED" ? "Live search is not connected yet." : ["DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE"].includes(message) ? "Neon database caching and request limits must be working before seller lookups." : message === "SERPAPI_MONTHLY_CAP_REACHED" ? "Tripfinder's monthly provider-search safety limit has been reached." : message === "SERPAPI_HOURLY_CAP_REACHED" ? "Tripfinder's shared hourly provider-search limit has been reached. Try again later." : message === "SERPAPI_PROVIDER_QUOTA_LOW" ? "The SerpApi account is near its remaining monthly search reserve. New provider searches are paused." : message === "SERPAPI_PROVIDER_HOURLY_LIMIT" ? "SerpApi's account-level hourly search allowance is nearly used. New provider searches are paused." : message === "SERPAPI_QUOTA_CHECK_FAILED" ? "Tripfinder could not verify the SerpApi account balance, so it paused new searches for safety." : message === "SERPAPI_CLIENT_RATE_LIMITED" ? "This connection has reached its travel-search limit. Please try again later." : message.slice(0, 220);
    return NextResponse.json({ error: safeMessage }, { status });
  }
}
