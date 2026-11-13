import { NextResponse } from "next/server";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { searchFlexibleFlightDates } from "@/lib/providers/serpapi";
import { validateTripSearchInput } from "@/lib/trip-planner/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const body = rawBody && typeof rawBody === "object" ? rawBody as Record<string, unknown> : {};
    const validated = validateTripSearchInput(body.search);
    if (!validated.input) return NextResponse.json({ error: "Please correct the trip details.", details: validated.errors }, { status: 400 });
    if (!validated.input.components.includes("flights")) return NextResponse.json({ error: "Choose flights to compare flexible travel dates." }, { status: 400 });
    if (validated.input.flexibleDays < 1 || validated.input.flexibleDays > 3) return NextResponse.json({ error: "Choose a date window from ±1 to ±3 days." }, { status: 400 });

    const destinationAirportCode = typeof body.destinationAirportCode === "string"
      ? body.destinationAirportCode.toUpperCase()
      : validated.input.destinationAirportCode;
    if (!/^[A-Z]{3}$/.test(destinationAirportCode)) {
      return NextResponse.json({ error: "Choose a valid destination airport before comparing flight dates." }, { status: 422 });
    }

    const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const result = await searchFlexibleFlightDates(validated.input, destinationAirportCode, hashClientAddress(address));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "FLEXIBLE_DATE_SEARCH_FAILED";
    const errors: Record<string, { status: number; message: string }> = {
      SERPAPI_NOT_CONFIGURED: { status: 503, message: "Live flight search is not configured. Add SERPAPI_API_KEY in Vercel." },
      DATABASE_NOT_CONFIGURED: { status: 503, message: "The Neon database is not configured, so Tripfinder cannot safely cache or limit this search." },
      DATABASE_UNAVAILABLE: { status: 503, message: "The travel cache and shared search limits are temporarily unavailable." },
      SERPAPI_MONTHLY_CAP_REACHED: { status: 429, message: "Tripfinder reached its monthly safety limit for new provider searches. Cached comparisons may still be available." },
      SERPAPI_HOURLY_CAP_REACHED: { status: 429, message: "Tripfinder reached its shared hourly search limit. Try again after the current hour." },
      SERPAPI_PROVIDER_QUOTA_LOW: { status: 429, message: "The SerpApi account is near its reserved monthly balance. New comparisons are paused to protect the remaining searches." },
      SERPAPI_PROVIDER_HOURLY_LIMIT: { status: 429, message: "The SerpApi hourly account reserve has been reached. Try again later." },
      SERPAPI_QUOTA_CHECK_FAILED: { status: 503, message: "Tripfinder could not verify the SerpApi account balance and paused this comparison for safety." },
      SERPAPI_CLIENT_RATE_LIMITED: { status: 429, message: "This connection reached its search limit. Try again later or use cached results." },
      ORIGIN_AIRPORT_UNRESOLVED: { status: 422, message: "Tripfinder could not resolve the departure airport. Check your origin airport." },
      DESTINATION_AIRPORT_UNRESOLVED: { status: 422, message: "Choose a valid arrival airport for this date comparison." },
      INVALID_FLEXIBLE_DATE_WINDOW: { status: 400, message: "Choose a flexible-date window between ±1 and ±3 days." },
    };
    const mapped = errors[code];
    return NextResponse.json({ error: mapped?.message ?? code.slice(0, 220), code }, { status: mapped?.status ?? 502 });
  }
}
