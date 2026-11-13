import { NextResponse } from "next/server";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { findDestination } from "@/lib/trip-planner/destinations";
import { getDestinationGateways } from "@/lib/trip-planner/location-suggestions";
import { searchLiveTravel } from "@/lib/providers/serpapi";
import { validateTripSearchInput } from "@/lib/trip-planner/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const validated = validateTripSearchInput(record.search);
    if (!validated.input) return NextResponse.json({ error: "Please correct the trip details.", details: validated.errors }, { status: 400 });

    const destinationName = typeof record.destinationName === "string" ? record.destinationName.slice(0, 120) : validated.input.destination;
    const destination = findDestination(destinationName);
    const suppliedAirportCode = typeof record.destinationAirportCode === "string" ? record.destinationAirportCode.toUpperCase() : "";
    const isRegionSearch = getDestinationGateways(validated.input.destination).length > 0;
    // Do not resolve a country/state name to the first curated city inside it
    // (for example, "United States" must not silently become Orlando).
    const inferredCityAirport = isRegionSearch ? "" : destination?.airportCode || "";
    const airportCode = suppliedAirportCode || inferredCityAirport;
    // An IATA airport is mandatory only for a flight request. Hotels, rentals,
    // attractions and restaurants can be searched against a state, country or
    // other text destination without inventing an airport.
    if (validated.input.components.includes("flights") && (!/^[A-Z]{3}$/.test(airportCode))) {
      return NextResponse.json({ error: "Choose a valid arrival airport for the flight portion of this search. Stays and activities can be searched without an airport.", code: "DESTINATION_AIRPORT_UNRESOLVED" }, { status: 422 });
    }

    const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const forceRefresh = record.forceRefresh === true;
    const result = await searchLiveTravel(validated.input, airportCode, destinationName, hashClientAddress(address), forceRefresh);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected travel search error.";
    if (message === "SERPAPI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Live search is not connected yet. Add SERPAPI_API_KEY in Vercel to enable it.", code: "PROVIDER_NOT_CONFIGURED" }, { status: 503 });
    }
    if (message === "DATABASE_NOT_CONFIGURED" || message === "DATABASE_UNAVAILABLE") {
      return NextResponse.json({ error: "The Neon database is not available. Check DATABASE_URL in Vercel and confirm the database is active before searching.", code: message }, { status: 503 });
    }
    if (message === "SERPAPI_MONTHLY_CAP_REACHED") {
      return NextResponse.json({ error: "Tripfinder has reached its monthly provider-search safety limit. Existing cached results remain available until they expire; new uncached searches will resume when the monthly allowance resets.", code: message }, { status: 429 });
    }
    if (message === "SERPAPI_HOURLY_CAP_REACHED") {
      return NextResponse.json({ error: "Tripfinder has reached its shared hourly provider-search safety limit. Try again after the current hour.", code: message }, { status: 429 });
    }
    if (message === "SERPAPI_PROVIDER_QUOTA_LOW") {
      return NextResponse.json({ error: "The SerpApi account is near its remaining-search reserve. New provider searches are paused to protect the account allowance.", code: message }, { status: 429 });
    }
    if (message === "SERPAPI_PROVIDER_HOURLY_LIMIT") {
      return NextResponse.json({ error: "SerpApi's account-level hourly search allowance is nearly used. Tripfinder paused new searches until the provider limit resets.", code: message }, { status: 429 });
    }
    if (message === "SERPAPI_QUOTA_CHECK_FAILED") {
      return NextResponse.json({ error: "Tripfinder could not verify the SerpApi account balance, so it paused new searches for safety. Check the API key and provider account status.", code: message }, { status: 503 });
    }
    if (message === "SERPAPI_CLIENT_RATE_LIMITED") {
      return NextResponse.json({ error: "This connection has reached its travel-search limit. Please use the cached results or try again later.", code: message }, { status: 429 });
    }
    if (message === "GEOAPIFY_DAILY_CAP_REACHED") {
      return NextResponse.json({ error: "Tripfinder has reached its shared Geoapify daily credit safety limit. Cached place results remain available; new Geoapify searches will resume after the UTC-day reset.", code: message }, { status: 429 });
    }
    if (message === "GEOAPIFY_CLIENT_DAILY_CAP_REACHED") {
      return NextResponse.json({ error: "This connection has reached its daily location-search allowance. Cached results remain available; please try again after the UTC-day reset.", code: message }, { status: 429 });
    }
    if (message === "GEOAPIFY_REQUEST_RATE_LIMITED" || message === "GEOAPIFY_PROVIDER_RATE_LIMITED") {
      return NextResponse.json({ error: "Tripfinder is spacing out location searches to protect the Geoapify request limit. Please try again shortly.", code: message }, { status: 429 });
    }
    if (message === "GEOAPIFY_NOT_CONFIGURED") {
      return NextResponse.json({ error: "The optional Geoapify location provider is not configured. Existing SerpApi location search remains available when configured.", code: message }, { status: 503 });
    }
    if (["GEOAPIFY_HTTP_401", "GEOAPIFY_HTTP_403"].includes(message)) {
      return NextResponse.json({ error: "Geoapify rejected the configured server-side API key or access plan. Check GEOAPIFY_API_KEY and the enabled Places API in the Geoapify account.", code: message }, { status: 503 });
    }
    if (message === "DESTINATION_AREA_REQUIRED") {
      return NextResponse.json({ error: "Choose a city or area within this country or region before searching for stays, attractions or restaurants. This prevents unrelated results from across the entire country.", code: message }, { status: 422 });
    }
    if (message === "ORIGIN_AIRPORT_UNRESOLVED") {
      return NextResponse.json({ error: "We could not match that departure city to an airport. Enter its three-letter IATA code, such as JFK or LAX.", code: message }, { status: 422 });
    }
    if (message === "DESTINATION_AIRPORT_UNRESOLVED") {
      return NextResponse.json({ error: "We could not match the destination to an airport. Choose a listed destination or use the direct search links.", code: message }, { status: 422 });
    }
    return NextResponse.json({ error: message.slice(0, 240), code: "TRAVEL_PROVIDER_ERROR" }, { status: 502 });
  }
}
