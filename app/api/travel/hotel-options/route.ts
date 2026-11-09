import { NextResponse } from "next/server";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { getHotelBookingOptions } from "@/lib/providers/serpapi";
import { validateTripSearchInput } from "@/lib/trip-planner/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const propertyToken = typeof body.propertyToken === "string" ? body.propertyToken : "";
    if (!propertyToken.trim() || propertyToken.length > 12000) return NextResponse.json({ error: "A valid property selection is required." }, { status: 400 });
    const validated = validateTripSearchInput(body.search);
    if (!validated.input) return NextResponse.json({ error: "Original trip dates and traveler details are required." }, { status: 400 });
    const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const offers = await getHotelBookingOptions(propertyToken, validated.input, hashClientAddress(address));
    return NextResponse.json({ offers, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve property rates.";
    const rateLimited = ["SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_PROVIDER_QUOTA_LOW", "SERPAPI_PROVIDER_HOURLY_LIMIT", "SERPAPI_CLIENT_RATE_LIMITED"].includes(message);
    const unavailable = ["SERPAPI_NOT_CONFIGURED", "DATABASE_NOT_CONFIGURED", "DATABASE_UNAVAILABLE", "SERPAPI_QUOTA_CHECK_FAILED"].includes(message);
    const safeMessage = rateLimited ? "The travel-provider request limit has been reached. Try again later." : unavailable ? "Property rate lookup is temporarily unavailable because the provider or database connection could not be verified." : message === "INVALID_PROPERTY_TOKEN" ? "This property selection has expired. Search for the property again." : "No separate booking rates could be retrieved for this property.";
    return NextResponse.json({ error: safeMessage }, { status: unavailable ? 503 : rateLimited ? 429 : message === "INVALID_PROPERTY_TOKEN" ? 400 : 502 });
  }
}
