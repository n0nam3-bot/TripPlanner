import { NextResponse } from "next/server";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { searchReturnFlights } from "@/lib/providers/serpapi";
import { validateTripSearchInput } from "@/lib/trip-planner/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const body = rawBody && typeof rawBody === "object" ? rawBody as Record<string, unknown> : {};
    const validated = validateTripSearchInput(body.search);
    if (!validated.input) return NextResponse.json({ error: "Please correct the trip details.", details: validated.errors }, { status: 400 });
    const destinationAirportCode = typeof body.destinationAirportCode === "string" ? body.destinationAirportCode.toUpperCase() : "";
    const departureToken = typeof body.departureToken === "string" ? body.departureToken : "";
    if (!/^[A-Z]{3}$/.test(destinationAirportCode)) return NextResponse.json({ error: "A valid destination airport code is required." }, { status: 400 });
    if (!departureToken || departureToken.length > 12000) return NextResponse.json({ error: "A valid outbound flight selection is required." }, { status: 400 });

    const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const result = await searchReturnFlights(validated.input, destinationAirportCode, departureToken, hashClientAddress(address));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected return-flight search error.";
    if (["SERPAPI_NOT_CONFIGURED", "DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE"].includes(message)) {
      return NextResponse.json({ error: "Live flight search is not configured or the Neon database is unavailable. Check the server-side Vercel environment variables." }, { status: 503 });
    }
    if (message === "SERPAPI_MONTHLY_CAP_REACHED") {
      return NextResponse.json({ error: "The monthly provider-search safety limit has been reached." }, { status: 429 });
    }
    if (message === "SERPAPI_HOURLY_CAP_REACHED") return NextResponse.json({ error: "The shared hourly provider-search safety limit has been reached. Try again later." }, { status: 429 });
    if (message === "SERPAPI_PROVIDER_QUOTA_LOW") return NextResponse.json({ error: "The SerpApi account is near its remaining-search reserve. New searches are paused." }, { status: 429 });
    if (message === "SERPAPI_PROVIDER_HOURLY_LIMIT") return NextResponse.json({ error: "SerpApi's account-level hourly search allowance is nearly used. Try again after the provider limit resets." }, { status: 429 });
    if (message === "SERPAPI_QUOTA_CHECK_FAILED") return NextResponse.json({ error: "The provider account balance could not be verified, so Tripfinder paused the search for safety." }, { status: 503 });
    if (message === "SERPAPI_CLIENT_RATE_LIMITED") {
      return NextResponse.json({ error: "This connection has reached its travel-search limit. Please try again later." }, { status: 429 });
    }
    if (message === "INVALID_DEPARTURE_TOKEN") return NextResponse.json({ error: "This outbound selection is no longer valid. Run the flight search again." }, { status: 400 });
    if (message === "ORIGIN_AIRPORT_UNRESOLVED" || message === "DESTINATION_AIRPORT_UNRESOLVED") {
      return NextResponse.json({ error: "The airport could not be resolved. Check the departure or destination airport." }, { status: 422 });
    }
    return NextResponse.json({ error: message.slice(0, 220) }, { status: 502 });
  }
}
