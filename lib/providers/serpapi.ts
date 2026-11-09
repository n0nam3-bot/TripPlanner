import { getProviderCache, providerCacheKey, reserveProviderSearch, setProviderCache } from "@/lib/db/travel-cache";
import { resolveAirportCode } from "@/lib/trip-planner/airports";
import type { TripSearchInput } from "@/lib/trip-planner/types";

const ENDPOINT = "https://serpapi.com/search.json";
type JsonObject = Record<string, unknown>;

export type LiveFlight = {
  id: string;
  price: number | null;
  currency: string;
  airlines: string[];
  from: string;
  to: string;
  departure: string;
  arrival: string;
  durationMinutes: number | null;
  stops: number;
  segments: Array<{ airline: string; flightNumber: string; from: string; to: string; departure: string; arrival: string; durationMinutes: number }>;
  /** Used to select the return leg for a round-trip search. */
  departureToken?: string;
  /** Used to retrieve sellers after the return leg has been selected. */
  bookingToken?: string;
};

export type LiveHotel = {
  id: string;
  name: string;
  source: string;
  rating: number | null;
  reviews: number | null;
  nightlyPrice: number | null;
  totalPrice: number | null;
  currency: string;
  address: string;
  amenities: string[];
  freeCancellation: boolean;
  image?: string;
  bookingUrl?: string;
};

export type LiveTravelSearchResult = {
  status: "live" | "partial" | "empty";
  provider: "SerpApi / Google Travel";
  checkedAt: string;
  dataAsOf: string;
  servedFromCache: boolean;
  flights: LiveFlight[];
  hotels: LiveHotel[];
  warnings: string[];
};

export type ReturnFlightSearchResult = {
  flights: LiveFlight[];
  checkedAt: string;
  dataAsOf: string;
  servedFromCache: boolean;
  warnings: string[];
};

function obj(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}
function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown, fallback = ""): string { return typeof value === "string" ? value : fallback; }
function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch { return undefined; }
}

type ProviderResponse = { data: JsonObject; fetchedAt: string; fromCache: boolean };
type ProviderQuota = {
  remaining: number;
  monthlyLimit: number | null;
  renewalDate: string | null;
  hourlyRemaining: number | null;
};

function dataTimestamp(data: JsonObject, fallback: string): string {
  const metadata = obj(data.search_metadata);
  const candidates = [metadata.created_at, metadata.processed_at];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback;
}

function providerWarning(error: unknown, label: string): string {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    SERPAPI_NOT_CONFIGURED: "Live travel search is not connected yet.",
    DATABASE_NOT_CONFIGURED: "The Neon database connection is not configured.",
    DATABASE_UNAVAILABLE: "The travel cache is temporarily unavailable.",
    SERPAPI_MONTHLY_CAP_REACHED: "Tripfinder reached its monthly safety limit for new provider searches.",
    SERPAPI_HOURLY_CAP_REACHED: "Tripfinder reached its shared hourly safety limit for new provider searches.",
    SERPAPI_PROVIDER_QUOTA_LOW: "The SerpApi account is near its monthly search reserve; new searches are paused.",
    SERPAPI_PROVIDER_HOURLY_LIMIT: "The SerpApi account is near its hourly throughput limit; new searches are paused.",
    SERPAPI_QUOTA_CHECK_FAILED: "Tripfinder could not verify the provider account balance, so it paused this search for safety.",
    SERPAPI_CLIENT_RATE_LIMITED: "This connection reached its search limit. Try again later.",
  };
  return `${label}: ${messages[code] ?? (code ? code.slice(0, 180) : "The provider could not complete this search.")}`;
}

async function getSerpApiQuota(apiKey: string): Promise<ProviderQuota> {
  const cacheKey = providerCacheKey({ internal: "serpapi-account-quota-v1" });
  try {
    const cached = await getProviderCache(cacheKey);
    if (cached) {
      const remaining = num(cached.payload.remaining);
      if (remaining !== null) return {
        remaining,
        monthlyLimit: num(cached.payload.monthlyLimit),
        renewalDate: str(cached.payload.renewalDate) || null,
        hourlyRemaining: num(cached.payload.hourlyRemaining),
      };
    }
  } catch {
    throw new Error("DATABASE_UNAVAILABLE");
  }

  let account: JsonObject;
  try {
    const url = new URL("https://serpapi.com/account.json");
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    account = obj(await response.json().catch(() => ({})));
    if (!response.ok || account.error) throw new Error("SERPAPI_QUOTA_CHECK_FAILED");
  } catch {
    throw new Error("SERPAPI_QUOTA_CHECK_FAILED");
  }

  const remaining = num(account.plan_searches_left) ?? num(account.total_searches_left);
  if (remaining === null) throw new Error("SERPAPI_QUOTA_CHECK_FAILED");
  const hourlyLimit = num(account.account_rate_limit_per_hour);
  const hourlyUsed = num(account.this_hour_searches);
  const quota: ProviderQuota = {
    remaining,
    monthlyLimit: num(account.searches_per_month),
    renewalDate: str(account.plan_renewal_date) || null,
    hourlyRemaining: hourlyLimit !== null && hourlyUsed !== null ? Math.max(0, hourlyLimit - hourlyUsed) : null,
  };
  try {
    await setProviderCache(cacheKey, quota as unknown as JsonObject, 60);
  } catch {
    throw new Error("DATABASE_UNAVAILABLE");
  }
  return quota;
}

async function querySerpApi(params: Record<string, string>, ttlSeconds = 3600, clientUsageKey = "shared"): Promise<ProviderResponse> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("SERPAPI_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");

  const cacheKey = providerCacheKey(params);
  let cached: Awaited<ReturnType<typeof getProviderCache>>;
  try {
    cached = await getProviderCache(cacheKey);
  } catch {
    throw new Error("DATABASE_UNAVAILABLE");
  }
  if (cached) return { data: cached.payload, fetchedAt: dataTimestamp(cached.payload, cached.fetchedAt), fromCache: true };

  // SerpApi's Account API does not consume search credits. Check the real account
  // balance before reserving an app slot, so searches from other projects are
  // accounted for and this app can keep a fixed safety reserve.
  const quota = await getSerpApiQuota(apiKey);
  const rawReserve = Number(process.env.SERPAPI_PROVIDER_QUOTA_RESERVE ?? "75");
  const reserve = Number.isInteger(rawReserve) ? Math.max(10, Math.min(200, rawReserve)) : 75;
  if (quota.remaining <= reserve) throw new Error("SERPAPI_PROVIDER_QUOTA_LOW");
  const rawHourlyReserve = Number(process.env.SERPAPI_PROVIDER_HOURLY_RESERVE ?? "10");
  const hourlyReserve = Number.isInteger(rawHourlyReserve) ? Math.max(1, Math.min(45, rawHourlyReserve)) : 10;
  if (quota.hourlyRemaining !== null && quota.hourlyRemaining <= hourlyReserve) {
    throw new Error("SERPAPI_PROVIDER_HOURLY_LIMIT");
  }

  // The persistent counter reserves a slot before calling the provider. Failed
  // attempts count conservatively so automated retries cannot exhaust the free quota.
  try {
    await reserveProviderSearch(clientUsageKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (["SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_CLIENT_RATE_LIMITED"].includes(message)) throw error;
    throw new Error("DATABASE_UNAVAILABLE");
  }

  const url = new URL(ENDPOINT);
  for (const [key, value] of Object.entries({ ...params, api_key: apiKey, output: "json" })) url.searchParams.set(key, value);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  const data = obj(await response.json().catch(() => ({})));
  if (!response.ok || data.error) {
    const message = str(data.error, `Travel search provider returned HTTP ${response.status}.`);
    throw new Error(message.replaceAll(apiKey, "[redacted]").slice(0, 220));
  }
  try {
    await setProviderCache(cacheKey, data, ttlSeconds);
  } catch {
    throw new Error("DATABASE_UNAVAILABLE");
  }
  const fetchedAt = dataTimestamp(data, new Date().toISOString());
  return { data, fetchedAt, fromCache: false };
}

function normalizeFlight(item: unknown, index: number, currency: string): LiveFlight | null {
  const flight = obj(item);
  const rawSegments = arr(flight.flights);
  if (!rawSegments.length) return null;
  const segments = rawSegments.map((raw) => {
    const segment = obj(raw);
    const dep = obj(segment.departure_airport);
    const arrv = obj(segment.arrival_airport);
    return {
      airline: str(segment.airline, "Airline not listed"),
      flightNumber: str(segment.flight_number, ""),
      from: `${str(dep.name, str(dep.id, "Unknown airport"))} (${str(dep.id, "—")})`,
      to: `${str(arrv.name, str(arrv.id, "Unknown airport"))} (${str(arrv.id, "—")})`,
      departure: str(dep.time, "Time not listed"),
      arrival: str(arrv.time, "Time not listed"),
      durationMinutes: num(segment.duration) ?? 0,
    };
  });
  const first = obj(rawSegments[0]);
  const last = obj(rawSegments[rawSegments.length - 1]);
  const firstDeparture = obj(first.departure_airport);
  const lastArrival = obj(last.arrival_airport);
  const airlines = [...new Set(segments.map((segment) => segment.airline))];
  const stops = Math.max(0, rawSegments.length - 1);
  const id = `${airlines.join("-")}-${str(first.flight_number, String(index))}-${str(firstDeparture.id, "")}-${str(lastArrival.id, "")}-${str(firstDeparture.time, "")}`.replace(/[^a-z0-9-]/gi, "-");
  return {
    id,
    price: num(flight.price),
    currency,
    airlines,
    from: `${str(firstDeparture.name, str(firstDeparture.id, "Origin"))} (${str(firstDeparture.id, "—")})`,
    to: `${str(lastArrival.name, str(lastArrival.id, "Destination"))} (${str(lastArrival.id, "—")})`,
    departure: str(firstDeparture.time, "Time not listed"),
    arrival: str(lastArrival.time, "Time not listed"),
    durationMinutes: num(flight.total_duration),
    stops,
    segments,
    departureToken: str(flight.departure_token) || undefined,
    bookingToken: str(flight.booking_token) || undefined,
  };
}

function normalizeHotel(item: unknown, index: number, currency: string): LiveHotel | null {
  const hotel = obj(item);
  const name = str(hotel.name);
  if (!name) return null;
  const nightly = obj(hotel.rate_per_night);
  const total = obj(hotel.total_rate);
  const imageList = arr(hotel.images);
  const firstImage = obj(imageList[0]);
  return {
    id: str(hotel.property_token, `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`),
    name,
    source: str(hotel.source, "Google Hotels"),
    rating: num(hotel.overall_rating),
    reviews: num(hotel.reviews),
    nightlyPrice: num(nightly.extracted_after_taxes_fees) ?? num(nightly.extracted_lowest),
    totalPrice: num(total.extracted_after_taxes_fees) ?? num(total.extracted_lowest),
    currency,
    address: str(hotel.address),
    amenities: arr(hotel.amenities).filter((item): item is string => typeof item === "string").slice(0, 8),
    freeCancellation: hotel.free_cancellation === true,
    image: safeHttpUrl(firstImage.thumbnail) ?? safeHttpUrl(hotel.thumbnail),
    bookingUrl: safeHttpUrl(hotel.link),
  };
}

function makeFlightParams(input: TripSearchInput, originCode: string, destinationAirportCode: string): Record<string, string> {
  const classMap = { economy: "1", premium_economy: "2", business: "3", first: "4" } as const;
  // Google Flights exposes maximum-stop filters, not an exact one-stop/two-stop filter.
  const stopMap = { any: "0", nonstop: "1", one_stop: "2", two_stops: "3" } as const;
  return {
    engine: "google_flights",
    departure_id: originCode,
    arrival_id: destinationAirportCode,
    type: "1",
    outbound_date: input.departureDate,
    return_date: input.returnDate,
    adults: String(input.adults),
    children: String(input.childrenAges.length),
    travel_class: classMap[input.cabinClass],
    stops: stopMap[input.stops],
    currency: input.currency,
    gl: "us",
    hl: "en",
    deep_search: "true",
  };
}

function normalizeFlights(data: JsonObject, currency: string): LiveFlight[] {
  const source = [...arr(data.best_flights), ...arr(data.other_flights)];
  return source.map((item, index) => normalizeFlight(item, index, currency)).filter((item): item is LiveFlight => Boolean(item)).slice(0, 8);
}

export async function searchLiveTravel(input: TripSearchInput, destinationAirportCode: string, destinationName: string, clientUsageKey = "shared"): Promise<LiveTravelSearchResult> {
  if (!process.env.SERPAPI_API_KEY) throw new Error("SERPAPI_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  const originCode = resolveAirportCode(input.origin);
  if (!originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (!destinationAirportCode || !/^[A-Z]{3}$/.test(destinationAirportCode)) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");

  const children = input.childrenAges.length;
  const flightParams = makeFlightParams(input, originCode, destinationAirportCode);
  const hotelParams: Record<string, string> = {
    engine: "google_hotels",
    q: `Hotels in ${destinationName}`,
    check_in_date: input.departureDate,
    check_out_date: input.returnDate,
    adults: String(input.adults),
    children: String(children),
    currency: input.currency,
    gl: "us",
    hl: "en",
    sort_by: "3",
  };
  if (children) hotelParams.children_ages = input.childrenAges.join(",");
  if (input.minimumHotelRating === 3) hotelParams.hotel_class = "3,4,5";
  else if (input.minimumHotelRating === 4) hotelParams.hotel_class = "4,5";
  else if (input.minimumHotelRating === 5) hotelParams.hotel_class = "5";
  if (input.freeCancellation) hotelParams.free_cancellation = "true";

  const warnings: string[] = [
    "Round-trip search begins with outbound options. Select an outbound flight to retrieve matching return flights; no round-trip fare is confirmed until a seller option is checked.",
  ];
  if (children) warnings.push("Google Flights receives the child count but not each child's age. Verify age-specific fares with the airline or seller. Google Hotels receives the exact child ages.");
  if (input.rooms > 1) warnings.push("Hotel results are withheld because this provider query cannot confirm your requested number of rooms. Use the provider link and set the room count there.");

  const [flightOutcome, hotelOutcome] = await Promise.allSettled([
    // Match the provider's documented one-hour response cache so repeat searches
    // reuse the same itinerary tokens without repeatedly requesting the provider.
    querySerpApi(flightParams, 3600, clientUsageKey),
    input.rooms === 1 ? querySerpApi(hotelParams, 3600, clientUsageKey) : Promise.resolve(null),
  ]);

  const rejectedMessages = [flightOutcome, hotelOutcome]
    .filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected")
    .map((outcome) => outcome.reason instanceof Error ? outcome.reason.message : "");
  if (flightOutcome.status === "rejected" && hotelOutcome.status === "rejected") {
    if (rejectedMessages.includes("SERPAPI_MONTHLY_CAP_REACHED")) throw new Error("SERPAPI_MONTHLY_CAP_REACHED");
    if (rejectedMessages.includes("SERPAPI_HOURLY_CAP_REACHED")) throw new Error("SERPAPI_HOURLY_CAP_REACHED");
    if (rejectedMessages.includes("SERPAPI_PROVIDER_QUOTA_LOW")) throw new Error("SERPAPI_PROVIDER_QUOTA_LOW");
    if (rejectedMessages.includes("SERPAPI_PROVIDER_HOURLY_LIMIT")) throw new Error("SERPAPI_PROVIDER_HOURLY_LIMIT");
    if (rejectedMessages.includes("SERPAPI_QUOTA_CHECK_FAILED")) throw new Error("SERPAPI_QUOTA_CHECK_FAILED");
    if (rejectedMessages.includes("SERPAPI_CLIENT_RATE_LIMITED")) throw new Error("SERPAPI_CLIENT_RATE_LIMITED");
    if (rejectedMessages.includes("DATABASE_UNAVAILABLE")) throw new Error("DATABASE_UNAVAILABLE");
  }

  let flights: LiveFlight[] = [];
  let hotels: LiveHotel[] = [];
  if (flightOutcome.status === "fulfilled") {
    flights = normalizeFlights(flightOutcome.value.data, input.currency);
    if (!flights.length) warnings.push("The flight provider returned no matching outbound options for this exact search.");
  } else {
    warnings.push(providerWarning(flightOutcome.reason, "Flight search"));
  }

  if (hotelOutcome.status === "fulfilled" && hotelOutcome.value) {
    hotels = arr(hotelOutcome.value.data.properties).map((item, index) => normalizeHotel(item, index, input.currency)).filter((item): item is LiveHotel => Boolean(item)).slice(0, 8);
    if (!hotels.length) warnings.push("The hotel provider returned no properties for these dates and traveler details.");
  } else if (hotelOutcome.status === "fulfilled" && !hotelOutcome.value) {
    // Multi-room offers are intentionally withheld rather than misrepresented.
  } else {
    warnings.push(providerWarning(hotelOutcome.reason, "Hotel search"));
  }

  const status = flights.length && hotels.length ? "live" : flights.length || hotels.length ? "partial" : "empty";
  const fetchedAt = [flightOutcome.status === "fulfilled" ? flightOutcome.value.fetchedAt : null, hotelOutcome.status === "fulfilled" && hotelOutcome.value ? hotelOutcome.value.fetchedAt : null].filter((value): value is string => Boolean(value));
  const cacheFlags = [flightOutcome.status === "fulfilled" ? flightOutcome.value.fromCache : null, hotelOutcome.status === "fulfilled" && hotelOutcome.value ? hotelOutcome.value.fromCache : null].filter((value): value is boolean => value !== null);
  return {
    status,
    provider: "SerpApi / Google Travel",
    checkedAt: new Date().toISOString(),
    dataAsOf: fetchedAt.sort()[0] ?? new Date().toISOString(),
    servedFromCache: cacheFlags.length > 0 && cacheFlags.every(Boolean),
    flights,
    hotels,
    warnings,
  };
}

export async function searchReturnFlights(input: TripSearchInput, destinationAirportCode: string, departureToken: string, clientUsageKey = "shared"): Promise<ReturnFlightSearchResult> {
  if (!process.env.SERPAPI_API_KEY) throw new Error("SERPAPI_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!departureToken || departureToken.length > 12000) throw new Error("INVALID_DEPARTURE_TOKEN");
  const originCode = resolveAirportCode(input.origin);
  if (!originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (!/^[A-Z]{3}$/.test(destinationAirportCode)) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");
  const params = { ...makeFlightParams(input, originCode, destinationAirportCode), departure_token: departureToken };
  const result = await querySerpApi(params, 3600, clientUsageKey);
  const flights = normalizeFlights(result.data, input.currency);
  return {
    flights,
    checkedAt: new Date().toISOString(),
    dataAsOf: result.fetchedAt,
    servedFromCache: result.fromCache,
    warnings: flights.length ? [] : ["No return flight options were returned for this outbound selection. Try another outbound option or check the airline directly."],
  };
}

export type FlightBookingOption = {
  seller: string;
  price: number | null;
  currency: string;
  url?: string;
  postFields: Array<{ name: string; value: string }>;
  type: string;
  baggage: string[];
  fareTerms: string[];
};

function safeGoogleBookingUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "google.com" || host.endsWith(".google.com")) ? url.toString() : undefined;
  } catch { return undefined; }
}

export async function getFlightBookingOptions(
  bookingToken: string,
  input: TripSearchInput,
  destinationAirportCode: string,
  clientUsageKey = "shared",
): Promise<FlightBookingOption[]> {
  if (!process.env.SERPAPI_API_KEY) throw new Error("SERPAPI_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!bookingToken || bookingToken.length > 12000) throw new Error("INVALID_BOOKING_TOKEN");
  const originCode = resolveAirportCode(input.origin);
  if (!originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (!/^[A-Z]{3}$/.test(destinationAirportCode)) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");

  // The provider documentation says to retain the original search context for
  // seller lookup. Only the opaque booking token is replaced; never construct it.
  const original = makeFlightParams(input, originCode, destinationAirportCode);
  // The selected token pins the itinerary. Keep the route, travelers, cabin and
  // localization, but omit dates and advanced filters that the provider says do
  // not affect booking-token lookups (and would only create duplicate cache keys).
  const params = {
    engine: "google_flights",
    departure_id: original.departure_id,
    arrival_id: original.arrival_id,
    adults: original.adults,
    children: original.children,
    travel_class: original.travel_class,
    currency: original.currency,
    gl: original.gl,
    hl: original.hl,
    booking_token: bookingToken,
  };
  const response = await querySerpApi(params, 3600, clientUsageKey);
  return arr(response.data.booking_options).map((item) => {
    const option = obj(item);
    const together = obj(option.together);
    const bookingRequest = obj(together.booking_request);
    const directUrl = safeHttpUrl(option.link);
    const googleUrl = safeGoogleBookingUrl(bookingRequest.url);
    const rawPostData = str(bookingRequest.post_data);
    const postFields = rawPostData
      ? Array.from(new URLSearchParams(rawPostData).entries()).slice(0, 50).map(([name, value]) => ({ name, value }))
      : [];
    const formUrl = googleUrl && postFields.length ? googleUrl : undefined;
    return {
      seller: str(together.book_with, str(option.book_with, "Booking provider")),
      price: num(together.price) ?? num(option.price),
      // The booking_options price is returned in the requested search currency.
      currency: input.currency,
      url: directUrl ?? formUrl,
      postFields: directUrl ? [] : postFields,
      type: str(together.option_title, str(option.type, "Online booking")),
      baggage: arr(together.baggage_prices).filter((entry): entry is string => typeof entry === "string").slice(0, 5),
      fareTerms: arr(together.extensions).filter((entry): entry is string => typeof entry === "string").slice(0, 6),
    };
  }).filter((item) => item.url).slice(0, 10);
}
