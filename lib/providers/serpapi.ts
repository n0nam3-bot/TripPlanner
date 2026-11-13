import { getProviderCache, getProviderCacheFallback, providerCacheKey, recordProviderEvent, reserveProviderSearch, setProviderCache } from "@/lib/db/travel-cache";
import { resolveAirportCode } from "@/lib/trip-planner/airports";
import { isBookingComConfigured, searchBookingComAccommodations } from "@/lib/providers/booking-com";
import { filterAndRankStays, googleAmenityFilterIds, inferStaySpaceType } from "@/lib/providers/stay-features";
import { AIRPORT_COORDINATES, destinationMetadata, getDestinationAreaGeo, getDestinationRegionScope, getDestinationStateRegion, getUSStateAddressAliases, getUSStateRegion } from "@/lib/trip-planner/location-suggestions";
import type { TripSearchInput, TripComponent, StaySpaceType, StayType } from "@/lib/trip-planner/types";
import { makeFlightBookingParams, makeFlightParams, makeReturnFlightParams } from "@/lib/trip-planner/flight-search-params";
import { makeFlexibleFlightCalendarParams, normalizeFlexibleFlightDateOptions, type FlexibleFlightDateOption } from "@/lib/trip-planner/flexible-flight-dates";
import { applyLayoverPreferences } from "@/lib/trip-planner/flight-search-policy";
import { safeGoogleBookingUrl } from "@/lib/trip-planner/flight-booking-url";
import { getGeoapifyDrivingRoute, searchGeoapifyPlaces } from "@/lib/providers/geoapify";

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
  segments: Array<{ airline: string; flightNumber: string; from: string; to: string; fromAirportCode: string; toAirportCode: string; departure: string; arrival: string; durationMinutes: number }>;
  /** Used to select the return leg for a round-trip search. */
  departureToken?: string;
  /** Used to retrieve sellers after the return leg has been selected. */
  bookingToken?: string;
};

export type LiveHotel = {
  id: string;
  name: string;
  source: string;
  propertyType: string;
  inventoryTypes: StayType[];
  spaceType: Exclude<StaySpaceType, "any"> | "unknown";
  description?: string;
  essentialInfo: string[];
  excludedAmenities: string[];
  propertyToken?: string;
  latitude: number | null;
  longitude: number | null;
  nearbyPlaces: Array<{ name: string; category: string; transportations: Array<{ type: string; duration: string }> }>;
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
  bookingUrlLabel: string;
  providerOffers: Array<{ seller: string; price: number | null; priceBasis: "stay" | "night" | "unknown"; currency: string; url?: string }>;
};

export type LiveExperience = {
  id: string;
  kind: "activity" | "restaurant";
  name: string;
  category: string;
  address: string;
  rating: number | null;
  reviews: number | null;
  latitude: number | null;
  longitude: number | null;
  thumbnail?: string;
  openState?: string;
  price?: string;
  website?: string;
  mapsUrl: string;
  source?: string;
  openingHours?: string;
};

export type HotelBookingOption = { seller: string; price: number | null; priceBasis: "stay" | "night" | "unknown"; currency: string; url?: string; terms: string[] };
export type SupplierOfferLookup<T> = {
  offers: T[];
  checkedAt: string;
  dataAsOf: string;
  servedFromCache: boolean;
  stale: boolean;
};

export type SearchCacheSummary = { key: string; label: string; status: "live" | "cached" | "stale"; fetchedAt: string };

export type LiveTravelSearchResult = {
  status: "live" | "partial" | "empty";
  provider: string;
  checkedAt: string;
  dataAsOf: string;
  servedFromCache: boolean;
  cacheSummary: SearchCacheSummary[];
  requested: TripComponent[];
  flights: LiveFlight[];
  hotels: LiveHotel[];
  experiences: LiveExperience[];
  providerSearchLinks?: { flights?: string };
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

type ProviderResponse = { data: JsonObject; fetchedAt: string; fromCache: boolean; isStale?: boolean };
type ProviderQuota = {
  remaining: number;
  monthlyLimit: number | null;
  renewalDate: string | null;
  hourlyRemaining: number | null;
  hourlyLimit: number | null;
  hourlyUsed: number | null;
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
    GEOAPIFY_NOT_CONFIGURED: "The Geoapify location provider is not configured.",
    GEOAPIFY_DAILY_CAP_REACHED: "Tripfinder reached its shared daily Geoapify credit safety limit.",
    GEOAPIFY_CLIENT_DAILY_CAP_REACHED: "This connection reached its daily location-search limit. Try again tomorrow.",
    GEOAPIFY_PROVIDER_RATE_LIMITED: "The Geoapify account reached its current request limit. Try again later.",
    GEOAPIFY_REQUEST_RATE_LIMITED: "Tripfinder is spacing out map requests to protect the Geoapify rate limit. Try again shortly.",
    GEOAPIFY_HTTP_401: "Geoapify rejected the configured API key. Check the server-side Vercel environment variable.",
    GEOAPIFY_HTTP_403: "Geoapify denied this request. Check the project key, enabled API access and plan limits.",
    GEOAPIFY_HTTP_400: "Geoapify rejected the place-search request. Check the destination anchor and provider response.",
  };
  return `${label}: ${messages[code] ?? (code ? code.slice(0, 180) : "The provider could not complete this search.")}`;
}

let quotaLookupInFlight: Promise<ProviderQuota> | null = null;

async function fetchSerpApiQuota(apiKey: string): Promise<ProviderQuota> {
  const cacheKey = providerCacheKey({ internal: "serpapi-account-quota-v1" });
  try {
    const cached = await getProviderCache(cacheKey);
    if (cached) {
      const remaining = num(cached.payload.remaining);
      if (remaining !== null) {
        await recordProviderEvent({ provider: "SerpApi", category: "Account quota", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
        return {
          remaining,
          monthlyLimit: num(cached.payload.monthlyLimit),
          renewalDate: str(cached.payload.renewalDate) || null,
          hourlyRemaining: num(cached.payload.hourlyRemaining),
          hourlyLimit: num(cached.payload.hourlyLimit),
          hourlyUsed: num(cached.payload.hourlyUsed),
        };
      }
    }
  } catch {
    throw new Error("DATABASE_UNAVAILABLE");
  }

  const startedAt = Date.now();
  let account: JsonObject;
  let httpStatus: number | null = null;
  try {
    const url = new URL("https://serpapi.com/account.json");
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    httpStatus = response.status;
    account = obj(await response.json().catch(() => ({})));
    if (!response.ok || account.error) throw new Error("SERPAPI_QUOTA_CHECK_FAILED");
  } catch {
    await recordProviderEvent({ provider: "SerpApi", category: "Account quota", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus, durationMs: Date.now() - startedAt });
    throw new Error("SERPAPI_QUOTA_CHECK_FAILED");
  }

  const remaining = num(account.plan_searches_left) ?? num(account.total_searches_left);
  if (remaining === null) {
    await recordProviderEvent({ provider: "SerpApi", category: "Account quota", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus, durationMs: Date.now() - startedAt });
    throw new Error("SERPAPI_QUOTA_CHECK_FAILED");
  }
  const hourlyLimit = num(account.account_rate_limit_per_hour);
  const hourlyUsed = num(account.this_hour_searches);
  const quota: ProviderQuota = {
    remaining,
    monthlyLimit: num(account.searches_per_month),
    renewalDate: str(account.plan_renewal_date) || null,
    hourlyRemaining: hourlyLimit !== null && hourlyUsed !== null ? Math.max(0, hourlyLimit - hourlyUsed) : null,
    hourlyLimit,
    hourlyUsed,
  };
  try {
    await setProviderCache(cacheKey, quota as unknown as JsonObject, 60);
  } catch {
    throw new Error("DATABASE_UNAVAILABLE");
  }
  await recordProviderEvent({ provider: "SerpApi", category: "Account quota", eventType: "account_check", outcome: "success", cacheStatus: "miss", httpStatus, durationMs: Date.now() - startedAt });
  return quota;
}

async function getSerpApiQuota(apiKey: string): Promise<ProviderQuota> {
  if (!quotaLookupInFlight) {
    quotaLookupInFlight = fetchSerpApiQuota(apiKey).finally(() => {
      quotaLookupInFlight = null;
    });
  }
  return quotaLookupInFlight;
}

function telemetryCategory(params: Record<string, string>): string {
  const engine = params.engine ?? "unknown";
  if (engine === "google_flights_calendar") return "Flexible flight dates";
  if (engine === "google_flights") {
    if (params.booking_token) return "Flight seller lookup";
    if (params.departure_token) return "Return flights";
    return "Flights";
  }
  if (engine === "google_hotels") {
    if (params.property_token) return "Hotel rate lookup";
    return params.vacation_rentals === "true" ? "Vacation rentals" : "Hotels";
  }
  if (engine === "google_maps") return /restaurant|food|dining|cafe|bar/i.test(params.q ?? "") ? "Restaurants and dining" : "Activities and attractions";
  if (engine === "google_local") return "Local places fallback";
  if (engine === "google_maps_directions") return "Directions";
  return engine.slice(0, 60);
}

function daysUntilProviderDate(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const target = Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((target - today) / 86400000);
}

type ProviderCachePolicy = { ttlSeconds: number; staleMaxAgeSeconds: number };

/** Category-specific freshness windows. Search parameters remain part of the cache key. */
export function getProviderCachePolicy(params: Record<string, string>): ProviderCachePolicy {
  const engine = params.engine ?? "";
  if (engine === "google_flights_calendar") return { ttlSeconds: 3600, staleMaxAgeSeconds: 12 * 3600 };
  // Seller-token lookups contain volatile offer prices; keep them much fresher
  // than broad discovery results. Explicit rechecks bypass the cache entirely.
  if (engine === "google_flights" && params.booking_token) return { ttlSeconds: 5 * 60, staleMaxAgeSeconds: 6 * 3600 };
  if (engine === "google_hotels" && params.property_token) return { ttlSeconds: 10 * 60, staleMaxAgeSeconds: 12 * 3600 };
  if (engine === "google_flights") {
    const days = daysUntilProviderDate(params.outbound_date);
    if (days !== null && days <= 7) return { ttlSeconds: 900, staleMaxAgeSeconds: 6 * 3600 };
    if (days !== null && days <= 30) return { ttlSeconds: 3600, staleMaxAgeSeconds: 12 * 3600 };
    return { ttlSeconds: 7200, staleMaxAgeSeconds: 24 * 3600 };
  }
  if (engine === "google_hotels") {
    const days = daysUntilProviderDate(params.check_in_date);
    if (days !== null && days <= 7) return { ttlSeconds: 1800, staleMaxAgeSeconds: 12 * 3600 };
    if (days !== null && days <= 30) return { ttlSeconds: 7200, staleMaxAgeSeconds: 24 * 3600 };
    return { ttlSeconds: 21600, staleMaxAgeSeconds: 72 * 3600 };
  }
  if (engine === "google_maps" || engine === "google_local") {
    return { ttlSeconds: 12 * 3600, staleMaxAgeSeconds: 7 * 86400 };
  }
  if (engine === "google_maps_directions") {
    return { ttlSeconds: 12 * 3600, staleMaxAgeSeconds: 24 * 3600 };
  }
  return { ttlSeconds: 3600, staleMaxAgeSeconds: 24 * 3600 };
}

async function querySerpApi(
  params: Record<string, string>,
  clientUsageKey = "shared",
  forceRefresh = false,
): Promise<ProviderResponse> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");

  const category = telemetryCategory(params);
  const cacheKey = providerCacheKey(params);
  const startedAt = Date.now();
  const policy = getProviderCachePolicy(params);
  let cached: Awaited<ReturnType<typeof getProviderCache>> = null;
  let staleCandidate: Awaited<ReturnType<typeof getProviderCacheFallback>> = null;
  try {
    cached = await getProviderCache(cacheKey);
    if (cached && !forceRefresh) {
      await recordProviderEvent({ provider: "SerpApi", category, eventType: "cache_hit", outcome: "success", cacheStatus: "hit", durationMs: Date.now() - startedAt });
      return { data: cached.payload, fetchedAt: dataTimestamp(cached.payload, cached.fetchedAt), fromCache: true };
    }
    // A forced refresh can still fall back to the current response if the
    // provider cannot refresh it. On an expired cache miss this finds recent
    // entries that are retained for up to seven days.
    staleCandidate = await getProviderCacheFallback(cacheKey, policy.staleMaxAgeSeconds);
  } catch {
    throw new Error("DATABASE_UNAVAILABLE");
  }

  const useStaleFallback = async (cause: unknown): Promise<ProviderResponse> => {
    if (!staleCandidate) throw cause;
    await recordProviderEvent({ provider: "SerpApi", category, eventType: "cache_hit", outcome: "success", cacheStatus: "stale", durationMs: Date.now() - startedAt });
    return {
      data: staleCandidate.payload,
      fetchedAt: dataTimestamp(staleCandidate.payload, staleCandidate.fetchedAt),
      fromCache: true,
      isStale: true,
    };
  };

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return useStaleFallback(new Error("SERPAPI_NOT_CONFIGURED"));

  try {
    // Account quota checks are free and cached separately for 60 seconds.
    let quota: ProviderQuota;
    try {
      quota = await getSerpApiQuota(apiKey);
    } catch (error) {
      await recordProviderEvent({ provider: "SerpApi", category, eventType: "request_blocked", outcome: "blocked", cacheStatus: "miss", durationMs: Date.now() - startedAt });
      throw error;
    }
    const rawReserve = Number(process.env.SERPAPI_PROVIDER_QUOTA_RESERVE ?? "75");
    const reserve = Number.isInteger(rawReserve) ? Math.max(10, Math.min(200, rawReserve)) : 75;
    if (quota.remaining <= reserve) {
      await recordProviderEvent({ provider: "SerpApi", category, eventType: "request_blocked", outcome: "blocked", cacheStatus: "miss", durationMs: Date.now() - startedAt });
      throw new Error("SERPAPI_PROVIDER_QUOTA_LOW");
    }
    const rawHourlyReserve = Number(process.env.SERPAPI_PROVIDER_HOURLY_RESERVE ?? "10");
    const hourlyReserve = Number.isInteger(rawHourlyReserve) ? Math.max(1, Math.min(45, rawHourlyReserve)) : 10;
    if (quota.hourlyRemaining !== null && quota.hourlyRemaining <= hourlyReserve) {
      await recordProviderEvent({ provider: "SerpApi", category, eventType: "request_blocked", outcome: "blocked", cacheStatus: "miss", durationMs: Date.now() - startedAt });
      throw new Error("SERPAPI_PROVIDER_HOURLY_LIMIT");
    }

    // Reserve a slot before making the billable provider request.
    try {
      await reserveProviderSearch(clientUsageKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      await recordProviderEvent({ provider: "SerpApi", category, eventType: "request_blocked", outcome: "blocked", cacheStatus: "miss", durationMs: Date.now() - startedAt });
      if (["SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_CLIENT_RATE_LIMITED"].includes(message)) throw error;
      throw new Error("DATABASE_UNAVAILABLE");
    }

    const url = new URL(ENDPOINT);
    for (const [key, value] of Object.entries({ ...params, api_key: apiKey, output: "json" })) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
    } catch (error) {
      await recordProviderEvent({ provider: "SerpApi", category, eventType: "provider_error", outcome: "error", cacheStatus: "miss", durationMs: Date.now() - startedAt });
      throw error;
    }
    const data = obj(await response.json().catch(() => ({})));
    if (!response.ok || data.error) {
      await recordProviderEvent({ provider: "SerpApi", category, eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      const message = str(data.error, `Travel search provider returned HTTP ${response.status}.`);
      throw new Error(message.replaceAll(apiKey, "[redacted]").slice(0, 220));
    }
    try {
      await setProviderCache(cacheKey, data, policy.ttlSeconds);
    } catch {
      await recordProviderEvent({ provider: "SerpApi", category, eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      // A successful live response is more useful than an older cached result.
      // Return it even if the Neon write fails; telemetry still records the live call.
      return { data, fetchedAt: dataTimestamp(data, new Date().toISOString()), fromCache: false };
    }
    await recordProviderEvent({ provider: "SerpApi", category, eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
    return { data, fetchedAt: dataTimestamp(data, new Date().toISOString()), fromCache: false };
  } catch (error) {
    return useStaleFallback(error);
  }
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
      fromAirportCode: str(dep.id, "").toUpperCase(),
      toAirportCode: str(arrv.id, "").toUpperCase(),
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

function normalizeLocationText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanDestinationSearchName(value: string): string {
  const seen = new Set<string>();
  return value.split(",").map((part) => part.trim()).filter((part) => {
    const key = normalizeLocationText(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(", ");
}

function isCountryWideSearch(destinationName: string): boolean {
  const metadata = destinationMetadata(destinationName);
  // An island destination such as Aruba can be searched as one practical base;
  // broad multi-city countries must be narrowed to a city/area first.
  return Boolean(metadata.country)
    && normalizeLocationText(metadata.city) === normalizeLocationText(metadata.country)
    && !metadata.airportCode;
}

function destinationLocalityTokens(destinationName: string): string[] {
  const state = getDestinationStateRegion(destinationName);
  const metadataCountry = normalizeLocationText(destinationMetadata(destinationName).country);
  const parts = destinationName.split(",").map(normalizeLocationText);
  const countryPart = parts.find((part) => Boolean(getDestinationRegionScope(part)) && !getUSStateRegion(part));
  return parts.filter((part) =>
    part.length >= 3
    && part !== "united states"
    && part !== metadataCountry
    && part !== countryPart
    && (!state || part !== normalizeLocationText(state.name))
  );
}

function googleCountryCode(destinationName: string): string {
  const metadata = destinationMetadata(destinationName);
  const parts = destinationName.split(",").map((part) => part.trim()).filter(Boolean);
  const country = normalizeLocationText(metadata.country || parts[parts.length - 1] || destinationName);
  const codes: Record<string, string> = {
    "dominican republic": "do", mexico: "mx", portugal: "pt", "puerto rico": "us", jamaica: "jm", aruba: "aw",
    "united states": "us", canada: "ca", france: "fr", italy: "it", spain: "es", japan: "jp", iceland: "is",
    "united kingdom": "uk", netherlands: "nl", germany: "de", switzerland: "ch", ireland: "ie", greece: "gr",
    bahamas: "bs", barbados: "bb", "costa rica": "cr", panama: "pa", colombia: "co", brazil: "br", argentina: "ar",
    chile: "cl", peru: "pe", australia: "au", "new zealand": "nz", thailand: "th", india: "in", "south korea": "kr",
    "united arab emirates": "ae", "south africa": "za", turkey: "tr", türkiye: "tr",
  };
  return codes[country] || "us";
}

function addressMatchesState(address: string, aliases: string[]): boolean {
  return aliases.some((alias) => alias.length > 2
    ? address.includes(alias)
    : new RegExp(`(^| )${alias}( |$)`).test(address));
}

function milesBetween(latitude: number, longitude: number, otherLatitude: number, otherLongitude: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(otherLatitude - latitude);
  const dLon = radians(otherLongitude - longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(otherLatitude)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sameProperty(left: LiveHotel, right: LiveHotel): boolean {
  if (normalizeLocationText(left.name) !== normalizeLocationText(right.name)) return false;
  if (left.latitude !== null && left.longitude !== null && right.latitude !== null && right.longitude !== null) {
    return milesBetween(left.latitude, left.longitude, right.latitude, right.longitude) <= 0.15;
  }
  const leftAddress = normalizeLocationText(left.address);
  const rightAddress = normalizeLocationText(right.address);
  return Boolean(leftAddress && rightAddress && leftAddress === rightAddress);
}

function mergeHotelSources(hotels: LiveHotel[]): LiveHotel[] {
  const merged: LiveHotel[] = [];
  for (const candidate of hotels) {
    const existingIndex = merged.findIndex((existing) => sameProperty(existing, candidate));
    if (existingIndex < 0) {
      merged.push(candidate);
      continue;
    }
    const existing = merged[existingIndex];
    const offers = [...existing.providerOffers, ...candidate.providerOffers];
    const uniqueOffers = [...new Map(offers.map((offer) => [
      `${normalizeLocationText(offer.seller)}|${offer.url || ""}|${offer.price ?? ""}|${offer.currency}`,
      offer,
    ])).values()];
    const sources = [...new Set(`${existing.source} + ${candidate.source}`.split("+").map((value) => value.trim()).filter(Boolean))];
    merged[existingIndex] = {
      ...existing,
      source: sources.join(" + "),
      propertyType: existing.propertyType || candidate.propertyType,
      inventoryTypes: [...new Set([...(existing.inventoryTypes ?? []), ...(candidate.inventoryTypes ?? [])])],
      latitude: existing.latitude ?? candidate.latitude,
      longitude: existing.longitude ?? candidate.longitude,
      nearbyPlaces: [...new Map([...existing.nearbyPlaces, ...candidate.nearbyPlaces].map((place) => [`${place.name}|${place.category}`, place])).values()].slice(0, 8),
      rating: existing.rating ?? candidate.rating,
      reviews: existing.reviews ?? candidate.reviews,
      nightlyPrice: existing.nightlyPrice ?? candidate.nightlyPrice,
      totalPrice: existing.totalPrice ?? candidate.totalPrice,
      address: existing.address || candidate.address,
      amenities: [...new Set([...existing.amenities, ...candidate.amenities])].slice(0, 40),
      excludedAmenities: [...new Set([...existing.excludedAmenities, ...candidate.excludedAmenities])].slice(0, 40),
      essentialInfo: [...new Set([...existing.essentialInfo, ...candidate.essentialInfo])].slice(0, 20),
      description: existing.description || candidate.description,
      spaceType: existing.spaceType !== "unknown" ? existing.spaceType : candidate.spaceType,
      image: existing.image || candidate.image,
      bookingUrl: existing.bookingUrl || candidate.bookingUrl,
      bookingUrlLabel: existing.bookingUrl ? existing.bookingUrlLabel : candidate.bookingUrlLabel,
      providerOffers: uniqueOffers,
    };
  }
  return merged;
}

function hotelSearchLocation(destinationName: string, airportCode: string): string {
  const gatewayLocations: Record<string, string> = {
    AUA: "Oranjestad, Aruba",
    PUJ: "Punta Cana, Dominican Republic",
    SDQ: "Santo Domingo, Dominican Republic",
    POP: "Puerto Plata, Dominican Republic",
    STI: "Santiago, Dominican Republic",
    LRM: "La Romana, Dominican Republic",
    CUN: "Cancun, Mexico",
    MEX: "Mexico City, Mexico",
    SJU: "San Juan, Puerto Rico",
    MBJ: "Montego Bay, Jamaica",
    LIS: "Lisbon, Portugal",
    MCO: "Orlando, Florida, United States",
    MSY: "New Orleans, Louisiana, United States",
  };
  // A state or explicitly selected city/area remains the accommodation target.
  // Do not let a flight gateway silently turn a state search into an airport-city search.
  if (getUSStateRegion(destinationName) || destinationName.includes(",")) return cleanDestinationSearchName(destinationName);
  return gatewayLocations[airportCode] ?? cleanDestinationSearchName(destinationName);
}

function hotelMatchesDestination(hotel: LiveHotel, airportCode: string, destinationName: string): boolean {
  const airport = AIRPORT_COORDINATES[airportCode];
  const area = getDestinationAreaGeo(destinationName);
  const stateAliases = getUSStateAddressAliases(destinationName);
  const broadState = Boolean(getUSStateRegion(destinationName));
  const localityTokens = destinationLocalityTokens(destinationName);
  const address = normalizeLocationText(`${hotel.address} ${hotel.name}`);

  if (area) {
    if (hotel.latitude !== null && hotel.longitude !== null) {
      return milesBetween(area.latitude, area.longitude, hotel.latitude, hotel.longitude) <= area.hotelRadiusMiles;
    }
    return Boolean(hotel.address) && area.addressAliases.some((alias) => address.includes(normalizeLocationText(alias)));
  }

  if (!airport && isCountryWideSearch(destinationName)) return Boolean(hotel.address);
  if (broadState) return Boolean(hotel.address) && addressMatchesState(normalizeLocationText(hotel.address), stateAliases);

  // For a specific city plus state, match the city and verify the state when
  // the provider includes it. This also works when a city is not an airport.
  if (localityTokens.length && hotel.address) {
    const localityMatch = localityTokens.some((token) => address.includes(token));
    const stateMatch = !stateAliases.length || addressMatchesState(normalizeLocationText(hotel.address), stateAliases);
    if (localityMatch && stateMatch) return true;
  }

  if (airport && hotel.latitude !== null && hotel.longitude !== null) {
    const distance = milesBetween(hotel.latitude, hotel.longitude, airport.latitude, airport.longitude);
    const radiusMiles = airportCode === "AUA" ? 45 : ["PUJ", "SDQ", "POP", "STI", "LRM"].includes(airportCode) ? 90 : 75;
    return distance <= radiusMiles;
  }

  // Never accept an addressless or clearly remote property merely because the
  // provider returned it for a locality query.
  return false;
}

function normalizeHotel(item: unknown, index: number, currency: string, destinationName: string, checkIn: string, checkOut: string, stayType: StayType): LiveHotel | null {
  const hotel = obj(item);
  const name = str(hotel.name);
  if (!name) return null;
  const nightly = obj(hotel.rate_per_night);
  const total = obj(hotel.total_rate);
  const imageList = arr(hotel.images);
  const firstImage = obj(imageList[0]);
  const coordinates = obj(hotel.gps_coordinates);
  const amenities = arr(hotel.amenities).filter((item): item is string => typeof item === "string");
  const excludedAmenities = arr(hotel.excluded_amenities).filter((item): item is string => typeof item === "string");
  const essentialInfo = arr(hotel.essential_info).filter((item): item is string => typeof item === "string");
  const description = str(hotel.description) || undefined;
  const propertyType = str(hotel.type, "hotel");
  const nearbyPlaces = arr(hotel.nearby_places).map((entry) => {
    const place = obj(entry);
    return {
      name: str(place.name, "Nearby place"),
      category: str(place.category, str(place.type, "Place")),
      transportations: arr(place.transportations).map((transport) => { const item = obj(transport); return { type: str(item.type, "Route"), duration: str(item.duration, "") }; }).filter((item) => item.duration),
    };
  }).filter((place) => place.name !== "Nearby place").slice(0, 8);
  const hotelSearchUrl = new URL("https://www.google.com/travel/search");
  hotelSearchUrl.searchParams.set("q", `${name} ${destinationName}`);
  hotelSearchUrl.searchParams.set("checkin", checkIn);
  hotelSearchUrl.searchParams.set("checkout", checkOut);
  const providerOffers = arr(hotel.prices).map((entry) => {
    const offer = obj(entry);
    const offerNightly = obj(offer.rate_per_night);
    const offerTotal = obj(offer.total_rate);
    const stayPrice = num(offerTotal.extracted_after_taxes_fees) ?? num(offerTotal.extracted_display_price) ?? num(offerTotal.extracted_lowest);
    const nightPrice = num(offerNightly.extracted_after_taxes_fees) ?? num(offerNightly.extracted_lowest) ?? num(offer.extracted_price);
    return {
      seller: str(offer.source, str(offer.name, "Booking provider")),
      price: stayPrice ?? nightPrice,
      priceBasis: stayPrice !== null ? "stay" as const : nightPrice !== null ? "night" as const : "unknown" as const,
      currency: str(offer.currency, currency),
      url: safeHttpUrl(offer.link) ?? safeHttpUrl(offer.url),
    };
  }).filter((offer) => offer.url || offer.price !== null).slice(0, 8);
  const officialWebsite = safeHttpUrl(hotel.website);
  const propertyDetailsUrl = safeHttpUrl(hotel.link);
  const mapUrl = safeHttpUrl(hotel.google_place_url) ?? safeHttpUrl(hotel.directions);
  const propertyUrl = officialWebsite ?? propertyDetailsUrl ?? mapUrl ?? hotelSearchUrl.toString();
  return {
    id: str(hotel.property_token, `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`),
    name,
    source: str(hotel.source, "Google Hotels"),
    propertyType,
    inventoryTypes: [stayType],
    spaceType: inferStaySpaceType({ propertyType, essentialInfo, description, amenities }),
    description,
    essentialInfo,
    excludedAmenities,
    propertyToken: str(hotel.property_token) || undefined,
    latitude: num(coordinates.latitude),
    longitude: num(coordinates.longitude),
    nearbyPlaces,
    rating: num(hotel.overall_rating),
    reviews: num(hotel.reviews),
    nightlyPrice: num(nightly.extracted_before_taxes_fees) ?? num(nightly.extracted_display_price) ?? num(nightly.extracted_lowest),
    totalPrice: num(total.extracted_after_taxes_fees) ?? num(total.extracted_display_price) ?? num(total.extracted_lowest),
    currency,
    address: str(hotel.address),
    amenities: amenities.slice(0, 40),
    freeCancellation: hotel.free_cancellation === true,
    image: safeHttpUrl(firstImage.thumbnail) ?? safeHttpUrl(hotel.thumbnail),
    bookingUrl: propertyUrl,
    bookingUrlLabel: officialWebsite ? "Official website" : propertyDetailsUrl ? "Property details" : mapUrl ? "View on Maps" : "View on Google Hotels",
    providerOffers,
  };
}

function normalizeFlights(data: JsonObject, currency: string): LiveFlight[] {
  const source = [...arr(data.best_flights), ...arr(data.other_flights)];
  // Keep enough alternatives for airline preferences such as Delta vs JetBlue.
  return source.map((item, index) => normalizeFlight(item, index, currency)).filter((item): item is LiveFlight => Boolean(item)).slice(0, 16);
}

function makeHotelParams(input: TripSearchInput, destinationName: string, airportCode: string, stayType: StayType): Record<string, string> {
  const spaceLabel = input.staySpaceType === "entire_place" ? "entire place" : input.staySpaceType === "private_room" ? "private room" : input.staySpaceType === "shared_room" ? "shared room" : "";
  const stayQuery = stayType === "vacation_rentals"
    ? `${spaceLabel ? `${spaceLabel} ` : ""}vacation rentals`
    : "Hotels";
  const params: Record<string, string> = {
    engine: "google_hotels",
    q: `${stayQuery} in ${hotelSearchLocation(destinationName, airportCode)}`,
    check_in_date: input.departureDate,
    check_out_date: input.returnDate,
    adults: String(input.adults),
    children: String(input.childrenAges.length),
    currency: input.currency,
    gl: googleCountryCode(destinationName),
    hl: "en",
    sort_by: "3",
  };
  if (stayType === "vacation_rentals") params.vacation_rentals = "true";
  const amenityIds = googleAmenityFilterIds(stayType, input.stayMustHaveAmenities);
  if (amenityIds.length) params.amenities = amenityIds.join(",");
  if (input.childrenAges.length) params.children_ages = input.childrenAges.join(",");
  // Google Hotels does not support hotel_class for vacation rentals.
  // Apply hotel class only to hotels; rental results remain unfiltered by class.
  if (stayType === "hotels") {
    if (input.minimumHotelRating === 3) params.hotel_class = "3,4,5";
    else if (input.minimumHotelRating === 4) params.hotel_class = "4,5";
    else if (input.minimumHotelRating === 5) params.hotel_class = "5";
    if (input.freeCancellation) params.free_cancellation = "true";
  }
  return params;
}

function experienceQueryForStyle(style: TripSearchInput["style"]): string {
  // Style affects ranking, not eligibility: always request a broad mix of sights.
  const terms: Record<TripSearchInput["style"], string> = {
    any: "top tourist attractions and things to do",
    beach: "top tourist attractions, popular beaches and island excursions",
    city: "top tourist attractions, landmarks and museums",
    food: "food markets and local cultural attractions",
    nature: "top nature attractions, national parks and scenic landmarks",
    romantic: "top scenic attractions, gardens and boat tours",
    family: "top family attractions, museums and wildlife parks",
    adventure: "top outdoor attractions, adventure tours and water activities",
    culture: "top historic attractions, museums and cultural landmarks",
  };
  return terms[style];
}

function normalizeExperiences(data: JsonObject, destinationName: string, kind: "activity" | "restaurant"): LiveExperience[] {
  const asEntries = (value: unknown): unknown[] => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  const entries = [
    ...asEntries(data.local_results),
    ...asEntries(data.place_results),
    ...asEntries(data.discover_more_places),
  ];
  const normalized = entries.map((entry, index) => {
    const place = obj(entry);
    const coords = obj(place.gps_coordinates);
    const name = str(place.title);
    if (!name) return null;
    const address = str(place.address);
    const placeId = str(place.place_id);
    const mapsUrl = placeId
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address || destinationName}`)}`;
    return {
      id: `${kind}-${placeId || str(place.data_id, `${name}-${index}`).replace(/[^a-z0-9-]/gi, "-")}`,
      kind,
      name,
      category: str(place.type, arr(place.types).map((v) => String(v)).slice(0, 2).join(" · ") || "Place to visit"),
      address,
      rating: num(place.rating),
      reviews: num(place.reviews),
      latitude: num(coords.latitude) ?? num(place.lat),
      longitude: num(coords.longitude) ?? num(place.lon),
      thumbnail: safeHttpUrl(place.thumbnail) ?? safeHttpUrl(place.serpapi_thumbnail),
      openState: str(place.open_state) || undefined,
      openingHours: str(place.opening_hours) || undefined,
      source: str(place.data_source) || "SerpApi / Google Maps and Local",
      price: str(place.price) || undefined,
      website: safeHttpUrl(place.website) ?? safeHttpUrl(obj(place.links).website),
      mapsUrl: safeHttpUrl(obj(place.links).directions) ?? mapsUrl,
    } as LiveExperience;
  }).filter((item): item is LiveExperience => Boolean(item));
  return [...new Map(normalized.map((item) => [item.id, item])).values()].slice(0, 50);
}

function filterDestinationExperiences(
  items: LiveExperience[],
  destinationName: string,
  destinationAirportCode: string,
  kind: "activity" | "restaurant",
): LiveExperience[] {
  const airport = AIRPORT_COORDINATES[destinationAirportCode];
  const area = getDestinationAreaGeo(destinationName);
  const stateAliases = getUSStateAddressAliases(destinationName);
  const broadState = Boolean(getUSStateRegion(destinationName));
  const broadCountrySearch = !airport && isCountryWideSearch(destinationName);
  const localityTokens = destinationLocalityTokens(destinationName);
  const radiusMiles = kind === "restaurant" ? 45 : 150;

  return items.filter((item) => {
    const address = normalizeLocationText(item.address);
    if (area) {
      if (item.latitude !== null && item.longitude !== null) {
        const limit = kind === "restaurant" ? area.restaurantRadiusMiles : area.activityRadiusMiles;
        return milesBetween(area.latitude, area.longitude, item.latitude, item.longitude) <= limit;
      }
      return Boolean(address) && area.addressAliases.some((alias) => address.includes(normalizeLocationText(alias)));
    }

    if (broadCountrySearch) return Boolean(address);
    if (broadState) return Boolean(address) && addressMatchesState(address, stateAliases);

    if (localityTokens.length && address) {
      const localityMatch = localityTokens.some((token) => address.includes(token));
      const stateMatch = !stateAliases.length || addressMatchesState(address, stateAliases);
      if (localityMatch && stateMatch) return true;
    }

    if (airport && item.latitude !== null && item.longitude !== null) {
      return milesBetween(airport.latitude, airport.longitude, item.latitude, item.longitude) <= radiusMiles;
    }

    // With no reliable point or address match, suppress remote listings.
    return false;
  });
}

async function searchPlacesWithFallback(
  query: string,
  destinationName: string,
  destinationAirportCode: string,
  kind: "activity" | "restaurant",
  clientUsageKey: string,
  forceRefresh = false,
): Promise<ProviderResponse> {
  const airport = AIRPORT_COORDINATES[destinationAirportCode];
  const area = getDestinationAreaGeo(destinationName);
  const geoCenter = area
    ? { latitude: area.latitude, longitude: area.longitude }
    : airport ? { latitude: airport.latitude, longitude: airport.longitude } : null;
  const mapsParams: Record<string, string> = {
    engine: "google_maps",
    type: "search",
    q: `${query} in ${destinationName}`,
    hl: "en",
    gl: googleCountryCode(destinationName),
  };
  if (area) mapsParams.ll = `@${area.latitude},${area.longitude},10z`;
  else if (airport) mapsParams.ll = `@${airport.latitude},${airport.longitude},12z`;

  let mapsResult: ProviderResponse | null = null;
  let mapsError: unknown = null;
  let mapEntries: unknown[] = [];
  let localCount = 0;
  try {
    // Google Maps remains the primary source because it supplies photos,
    // ratings, review counts and exact Google place links when available.
    mapsResult = await querySerpApi(mapsParams, clientUsageKey, forceRefresh);
    mapEntries = [
      ...arr(mapsResult.data.local_results),
      ...arr(mapsResult.data.place_results),
      ...arr(mapsResult.data.discover_more_places),
    ];
    localCount = filterDestinationExperiences(
      normalizeExperiences(mapsResult.data, destinationName, kind),
      destinationName,
      destinationAirportCode,
      kind,
    ).length;
    // A useful Google result set is returned unchanged; no Geoapify credits are spent.
    if (localCount >= 6) return mapsResult;
  } catch (error) {
    mapsError = error;
  }

  if (process.env.GEOAPIFY_API_KEY?.trim() && geoCenter) {
    try {
      // Geoapify is the spatially bounded fallback, not a replacement for
      // Google's rich listing data. Merge its local records behind Google rows.
      const fallbackResult = await searchGeoapifyPlaces({
        center: geoCenter,
        radiusMeters: Math.round((area
          ? (kind === "restaurant" ? area.restaurantRadiusMiles : area.activityRadiusMiles)
          : (kind === "restaurant" ? 45 : 60)) * 1609.344),
        kind,
        clientUsageKey,
        forceRefresh,
      });
      const fallbackEntries = arr(fallbackResult.data.local_results);
      const combined = [...mapEntries, ...fallbackEntries];
      const deduped = [...new Map(combined.map((entry) => {
        const item = obj(entry);
        const coords = obj(item.gps_coordinates);
        const titleKey = str(item.title, str(item.name, "place")).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const addressKey = str(item.address).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const lat = num(coords.latitude);
        const lon = num(coords.longitude);
        const coordinateKey = lat !== null && lon !== null ? `${lat.toFixed(4)},${lon.toFixed(4)}` : "";
        // Stable cross-provider key keeps Google rows (which occur first) when
        // Geoapify returns the same venue with a different provider place ID.
        const key = coordinateKey ? `${titleKey}|${coordinateKey}` : `${titleKey}|${addressKey}`;
        return [key, item];
      })).values()];
      if (!deduped.length && mapsError) throw mapsError;
      const oldestFetchedAt = [mapsResult?.fetchedAt, fallbackResult.fetchedAt]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || fallbackResult.fetchedAt;
      return {
        data: { ...fallbackResult.data, ...(mapsResult?.data ?? {}), local_results: deduped, place_results: [], discover_more_places: [] },
        fetchedAt: oldestFetchedAt,
        fromCache: Boolean((!mapsResult || mapsResult.fromCache) && fallbackResult.fromCache),
        isStale: Boolean(mapsResult?.isStale || fallbackResult.isStale),
      };
    } catch (fallbackError) {
      if (mapsResult && localCount > 0) return mapsResult;
      if (mapsError) throw mapsError;
      throw fallbackError;
    }
  }

  if (mapsResult) return mapsResult;
  if (mapsError) throw mapsError;
  throw new Error("PLACE_SEARCH_UNAVAILABLE");
}

export type FlexibleFlightDateSearchResult = {
  options: FlexibleFlightDateOption[];
  checkedAt: string;
  dataAsOf: string;
  servedFromCache: boolean;
  stale: boolean;
  warnings: string[];
};

/** Compare a small date window with one Google Flights Calendar API request. */
export async function searchFlexibleFlightDates(
  input: TripSearchInput,
  destinationAirportCode: string,
  clientUsageKey = "shared",
): Promise<FlexibleFlightDateSearchResult> {
  if (!input.components.includes("flights")) throw new Error("FLEXIBLE_DATES_REQUIRE_FLIGHTS");
  if (input.flexibleDays < 1 || input.flexibleDays > 3) throw new Error("INVALID_FLEXIBLE_DATE_WINDOW");
  const originCode = input.originAirportCode || resolveAirportCode(input.origin);
  if (!originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (!/^[A-Z]{3}$/.test(destinationAirportCode)) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");
  const params = makeFlexibleFlightCalendarParams(input, originCode, destinationAirportCode);
  const result = await querySerpApi(params, clientUsageKey);
  const options = normalizeFlexibleFlightDateOptions(
    result.data.prices,
    input.currency,
    params.date_range_start,
    params.date_range_end,
  );
  return {
    options,
    checkedAt: new Date().toISOString(),
    dataAsOf: result.fetchedAt,
    servedFromCache: result.fromCache,
    stale: Boolean(result.isStale),
    warnings: options.length ? [] : ["No flexible-date price indications were returned for this route and date window. Try exact dates or expand the window by one day."],
  };
}

export async function searchLiveTravel(input: TripSearchInput, destinationAirportCode: string, destinationName: string, clientUsageKey = "shared", forceRefresh = false): Promise<LiveTravelSearchResult> {
  if ((input.components.includes("stays") || input.components.includes("activities")) && isCountryWideSearch(destinationName)) {
    throw new Error("DESTINATION_AREA_REQUIRED");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  const components = input.components;
  const normalizedDestinationName = cleanDestinationSearchName(destinationName);
  const originCode = input.originAirportCode || resolveAirportCode(input.origin);
  const destinationCode = input.destinationAirportCode || destinationAirportCode;
  const geoapifyPlacesActive = Boolean(process.env.GEOAPIFY_API_KEY?.trim() && (
    getDestinationAreaGeo(normalizedDestinationName) || AIRPORT_COORDINATES[destinationCode || destinationAirportCode]
  ));
  if (components.includes("flights") && !originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (components.includes("flights") && (!destinationCode || !/^[A-Z]{3}$/.test(destinationCode))) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");

  const tasks: Array<{ key: "flights" | "hotels" | "vacation_rentals" | "experiences" | "restaurants"; promise: Promise<ProviderResponse> }> = [];
  if (components.includes("flights")) tasks.push({ key: "flights", promise: querySerpApi(makeFlightParams(input, originCode!, destinationCode!), clientUsageKey, forceRefresh) });
  if (components.includes("stays")) {
    for (const stayType of input.stayTypes) {
      tasks.push({ key: stayType === "hotels" ? "hotels" : "vacation_rentals", promise: querySerpApi(makeHotelParams(input, normalizedDestinationName, destinationCode || destinationAirportCode, stayType), clientUsageKey, forceRefresh) });
    }
  }
  if (components.includes("activities")) {
    tasks.push({ key: "experiences", promise: searchPlacesWithFallback(experienceQueryForStyle(input.style), normalizedDestinationName, destinationCode || destinationAirportCode, "activity", clientUsageKey, forceRefresh) });
    tasks.push({ key: "restaurants", promise: searchPlacesWithFallback("popular restaurants, highly rated local dining, casual restaurants and local food", normalizedDestinationName, destinationCode || destinationAirportCode, "restaurant", clientUsageKey, forceRefresh) });
  }

  const bookingPromise = components.includes("stays") && isBookingComConfigured()
    ? searchBookingComAccommodations(input, normalizedDestinationName, destinationCode || destinationAirportCode, forceRefresh)
    : Promise.resolve(null);
  const [outcomes, bookingResult] = await Promise.all([
    Promise.allSettled(tasks.map((task) => task.promise)),
    bookingPromise,
  ]);
  const errors = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected").map((outcome) => outcome.reason instanceof Error ? outcome.reason.message : "");
  const successfulCount = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
  if (successfulCount === 0 && errors.length && !(bookingResult?.hotels.length)) {
    const priority = ["GEOAPIFY_DAILY_CAP_REACHED", "GEOAPIFY_CLIENT_DAILY_CAP_REACHED", "GEOAPIFY_REQUEST_RATE_LIMITED", "GEOAPIFY_PROVIDER_RATE_LIMITED", "SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_PROVIDER_QUOTA_LOW", "SERPAPI_PROVIDER_HOURLY_LIMIT", "SERPAPI_QUOTA_CHECK_FAILED", "SERPAPI_CLIENT_RATE_LIMITED", "DATABASE_UNAVAILABLE", "DATABASE_NOT_CONFIGURED", "SERPAPI_NOT_CONFIGURED"];
    const selected = priority.find((code) => errors.includes(code));
    if (selected) throw new Error(selected);
  }

  const warnings: string[] = [];
  let flights: LiveFlight[] = [];
  let hotels: LiveHotel[] = [];
  let experiences: LiveExperience[] = [];
  let restaurants: LiveExperience[] = [];
  const fetchedAt: string[] = [];
  const cacheFlags: boolean[] = [];
  const cacheSummary: SearchCacheSummary[] = [];
  let providerSearchLinks: { flights?: string } = {};

  if (bookingResult) {
    if (bookingResult.warning) warnings.push(bookingResult.warning);
    hotels = [...hotels, ...bookingResult.hotels];
    fetchedAt.push(bookingResult.fetchedAt);
    cacheFlags.push(bookingResult.fromCache);
    cacheSummary.push({
      key: "booking-com-accommodations",
      label: "Booking.com accommodations",
      status: bookingResult.isStale ? "stale" : bookingResult.fromCache ? "cached" : "live",
      fetchedAt: bookingResult.fetchedAt,
    });
    if (bookingResult.isStale) {
      warnings.push(`Booking.com accommodation results are showing saved data from ${new Date(bookingResult.fetchedAt).toLocaleString()}; prices and availability may have changed.`);
    }
  }

  outcomes.forEach((outcome, index) => {
    const key = tasks[index].key;
    if (outcome.status === "rejected") {
      warnings.push(providerWarning(outcome.reason, key === "flights" ? "Flight search" : key === "experiences" ? "Things-to-do search" : key === "restaurants" ? "Restaurant search" : key === "vacation_rentals" ? "Vacation-rental search" : "Hotel search"));
      return;
    }
    fetchedAt.push(outcome.value.fetchedAt);
    cacheFlags.push(outcome.value.fromCache);
    const categoryLabel = key === "flights" ? "Flights" : key === "hotels" ? "Hotels" : key === "vacation_rentals" ? "Vacation rentals" : key === "experiences" ? "Activities" : "Restaurants";
    cacheSummary.push({ key, label: categoryLabel, status: outcome.value.isStale ? "stale" : outcome.value.fromCache ? "cached" : "live", fetchedAt: outcome.value.fetchedAt });
    if (outcome.value.isStale) {
      warnings.push(`${categoryLabel} are showing saved results from ${new Date(outcome.value.fetchedAt).toLocaleString()} because a live refresh was unavailable. Prices and availability may have changed.`);
    }
    if (key === "flights") {
      const metadata = obj(outcome.value.data.search_metadata);
      providerSearchLinks.flights = safeHttpUrl(metadata.google_flights_url);
      const normalizedFlights = normalizeFlights(outcome.value.data, input.currency);
      const layoverFilter = applyLayoverPreferences(normalizedFlights, input);
      flights = layoverFilter.flights;
      warnings.push(...layoverFilter.warnings);
      if (!flights.length) warnings.push(normalizedFlights.length ? "No flight options remain after applying the selected connection-country preferences. Remove an avoid-country or broaden the stopover preferences to see more routes." : "Google Flights returned no outbound options for this route and date combination. Try a different departure airport or open the route directly in Google Flights.");
    } else if (key === "hotels" || key === "vacation_rentals") {
      const properties = arr(outcome.value.data.properties);
      const stayType: StayType = key === "vacation_rentals" ? "vacation_rentals" : "hotels";
      const normalized = properties.map((item, itemIndex) => normalizeHotel(item, itemIndex, input.currency, normalizedDestinationName, input.departureDate, input.returnDate, stayType)).filter((item): item is LiveHotel => Boolean(item));
      const inDestination = normalized.filter((hotel) => hotelMatchesDestination(hotel, destinationCode || destinationAirportCode, normalizedDestinationName));
      hotels = [...hotels, ...inDestination];
      const rejectedLocationCount = normalized.length - inDestination.length;
      if (rejectedLocationCount > 0) {
        warnings.push(`Google Hotels returned ${rejectedLocationCount} properties outside ${hotelSearchLocation(normalizedDestinationName, destinationCode || destinationAirportCode)}; those mismatched properties were removed.`);
      }
      if (!inDestination.length && !normalized.length) {
        warnings.push(key === "vacation_rentals" ? "No vacation-rental properties were returned for those dates, guests and destination." : "No hotel properties were returned for those dates, guests and destination.");
      }
    } else if (key === "experiences") {
      experiences = filterDestinationExperiences(
        normalizeExperiences(outcome.value.data, normalizedDestinationName, "activity"),
        normalizedDestinationName,
        destinationCode || destinationAirportCode,
        "activity",
      ).slice(0, 30);
      if (!experiences.length) warnings.push("No local attractions or activities were returned for this destination. Try a nearby town or search directly on a tour provider.");
    } else if (key === "restaurants") {
      restaurants = filterDestinationExperiences(
        normalizeExperiences(outcome.value.data, normalizedDestinationName, "restaurant"),
        normalizedDestinationName,
        destinationCode || destinationAirportCode,
        "restaurant",
      ).slice(0, 30);
      if (!restaurants.length) warnings.push("No restaurant results were returned for this destination. Try searching Maps directly for current dining options.");
    }
  });

  const mergedHotels = mergeHotelSources([...new Map(hotels.map((item) => [item.id, item])).values()]);
  const stayFilterResult = filterAndRankStays(mergedHotels, input);
  const uniqueHotels = stayFilterResult.hotels.slice(0, 18);
  if (components.includes("stays") && stayFilterResult.excludedCount > 0 && (input.stayMustHaveAmenities.length || input.staySpaceType !== "any")) {
    warnings.push(`${stayFilterResult.excludedCount} accommodation listings were removed because the selected space type or must-have features were not explicitly confirmed in the provider listing. A generic pool does not count as a private pool, and an unspecified room type is not assumed to be an entire property.`);
  }
  const hasFlights = !components.includes("flights") || flights.length > 0;
  const hasStays = !components.includes("stays") || uniqueHotels.length > 0;
  const hasActivities = !components.includes("activities") || experiences.length > 0 || restaurants.length > 0;
  const fulfilledRequestedCategories = [hasFlights, hasStays, hasActivities].filter(Boolean).length;
  const status = fulfilledRequestedCategories === 0 ? "empty" : fulfilledRequestedCategories === components.length ? "live" : "partial";
  if (input.rooms > 1 && components.includes("stays") && uniqueHotels.some((hotel) => hotel.source.includes("Google Hotels"))) warnings.push(`Google Hotels does not expose a room-count parameter for this search endpoint. Its property-level rates may not represent ${input.rooms} rooms; reconfirm the room allocation, guest distribution, taxes and total directly with the seller. Booking.com results, when present, include the requested room count.`);
  if (input.childrenAges.length && components.includes("flights")) warnings.push("The flight provider applies child count but does not confirm age-specific fare rules here. Verify passenger ages and fares with the airline or seller.");
  return {
    status,
    provider: [
      "SerpApi / Google Travel",
      components.includes("activities") && geoapifyPlacesActive ? "Geoapify / OpenStreetMap Places" : components.includes("activities") ? "Google Maps/Local via SerpApi" : "",
      bookingResult?.hotels.length ? "Booking.com" : "",
    ].filter(Boolean).join(" + "),
    checkedAt: new Date().toISOString(),
    dataAsOf: fetchedAt.sort()[0] ?? new Date().toISOString(),
    servedFromCache: cacheFlags.length > 0 && cacheFlags.every(Boolean),
    cacheSummary,
    requested: components,
    flights,
    hotels: uniqueHotels,
    experiences: [...new Map([...experiences, ...restaurants].map((item) => [item.id, item])).values()],
    providerSearchLinks,
    warnings,
  };
}

export async function getHotelBookingOptions(
  propertyToken: string,
  input: TripSearchInput,
  clientUsageKey = "shared",
  forceRefresh = false,
): Promise<SupplierOfferLookup<HotelBookingOption>> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!propertyToken || propertyToken.length > 12000) throw new Error("INVALID_PROPERTY_TOKEN");
  const params: Record<string, string> = {
    engine: "google_hotels", property_token: propertyToken,
    check_in_date: input.departureDate, check_out_date: input.returnDate,
    adults: String(input.adults), children: String(input.childrenAges.length),
    currency: input.currency, gl: "us", hl: "en",
  };
  if (input.childrenAges.length) params.children_ages = input.childrenAges.join(",");
  const result = await querySerpApi(params, clientUsageKey, forceRefresh);
  const candidates = [...arr(result.data.ads), ...arr(result.data.prices)];
  const offers = candidates.map((entry) => {
    const offer = obj(entry);
    const rate = obj(offer.rate_per_night);
    const total = obj(offer.total_rate);
    const stayPrice = num(total.extracted_after_taxes_fees) ?? num(total.extracted_display_price) ?? num(total.extracted_lowest);
    const nightPrice = num(rate.extracted_after_taxes_fees) ?? num(rate.extracted_display_price) ?? num(rate.extracted_lowest);
    const unclassifiedPrice = num(offer.extracted_price) ?? num(offer.price);
    const price = stayPrice ?? nightPrice ?? unclassifiedPrice;
    const priceBasis: HotelBookingOption["priceBasis"] = stayPrice !== null ? "stay" : nightPrice !== null ? "night" : "unknown";
    const link = safeHttpUrl(offer.link) ?? safeHttpUrl(offer.url);
    const terms = [...arr(offer.extensions), ...arr(offer.terms)].filter((value): value is string => typeof value === "string").slice(0, 5);
    return { seller: str(offer.name, str(offer.source, str(offer.provider, "Booking provider"))), price, priceBasis, currency: str(offer.currency, input.currency), url: link, terms };
  }).filter((offer) => Boolean(offer.url) || offer.price !== null);
  const uniqueOffers = [...new Map(offers.map((offer) => [`${offer.seller}:${offer.url ?? offer.price}:${offer.priceBasis}`, offer])).values()].slice(0, 12);
  return {
    offers: uniqueOffers,
    checkedAt: new Date().toISOString(),
    dataAsOf: result.fetchedAt,
    servedFromCache: result.fromCache,
    stale: Boolean(result.isStale),
  };
}

export type DrivingRouteResult = { distance: string; duration: string; durationInTraffic?: string; startAddress?: string; endAddress?: string; source: string; checkedAt: string; mapImageDataUrl?: string; directions?: string[]; mapWarning?: string };
export type RouteCoordinates = { latitude: number; longitude: number };

export async function getDrivingRoute(
  origin: string,
  destination: string,
  clientUsageKey = "shared",
  coordinates?: { origin?: RouteCoordinates; destination?: RouteCoordinates },
  options: { forceMapRefresh?: boolean } = {},
): Promise<DrivingRouteResult | null> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  const cleanOrigin = origin.trim().slice(0, 300);
  const cleanDestination = destination.trim().slice(0, 300);
  if (!cleanOrigin || !cleanDestination) throw new Error("INVALID_ROUTE_ENDPOINTS");
  if (process.env.GEOAPIFY_API_KEY?.trim() && coordinates?.origin && coordinates?.destination) {
    const route = await getGeoapifyDrivingRoute({
      origin: coordinates.origin,
      destination: coordinates.destination,
      originLabel: cleanOrigin,
      destinationLabel: cleanDestination,
      clientUsageKey,
      forceMapRefresh: options.forceMapRefresh === true,
    });
    if (!route) return null;
    return {
      distance: route.distance,
      duration: route.duration,
      startAddress: route.startAddress,
      endAddress: route.endAddress,
      source: route.source,
      checkedAt: route.checkedAt,
      ...(route.mapImageDataUrl ? { mapImageDataUrl: route.mapImageDataUrl } : {}),
      directions: route.directions,
      ...(route.mapWarning ? { mapWarning: route.mapWarning } : {}),
    };
  }
  const result = await querySerpApi({
    engine: "google_maps_directions",
    start_addr: cleanOrigin,
    end_addr: cleanDestination,
    travel_mode: "0",
    distance_unit: "1",
    hl: "en",
    gl: "us",
  }, clientUsageKey);
  const routeList = arr(result.data.directions);
  const route = obj(routeList[0]);
  const distance = str(route.formatted_distance, str(route.distance));
  const duration = str(route.formatted_duration, str(route.duration));
  const traffic = str(route.duration_in_traffic, str(route.formatted_duration_in_traffic)) || undefined;
  if (!distance || !duration) return null;
  return {
    distance,
    duration,
    durationInTraffic: traffic,
    startAddress: str(route.start_address) || undefined,
    endAddress: str(route.end_address) || undefined,
    source: "Google Maps directions via SerpApi",
    checkedAt: result.fetchedAt,
  };
}

export async function searchReturnFlights(input: TripSearchInput, destinationAirportCode: string, departureToken: string, clientUsageKey = "shared"): Promise<ReturnFlightSearchResult> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!departureToken || departureToken.length > 12000) throw new Error("INVALID_DEPARTURE_TOKEN");
  const originCode = input.originAirportCode || resolveAirportCode(input.origin);
  if (!originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (!/^[A-Z]{3}$/.test(destinationAirportCode)) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");
  const params = makeReturnFlightParams(input, originCode, destinationAirportCode, departureToken);
  const result = await querySerpApi(params, clientUsageKey);
  const normalizedFlights = normalizeFlights(result.data, input.currency);
  const layoverFilter = applyLayoverPreferences(normalizedFlights, input);
  const flights = layoverFilter.flights;
  return {
    flights,
    checkedAt: new Date().toISOString(),
    dataAsOf: result.fetchedAt,
    servedFromCache: result.fromCache,
    warnings: [...layoverFilter.warnings, ...(flights.length ? [] : [normalizedFlights.length ? "No return flights remain after applying the selected connection-country preferences." : "No return flight options were returned for this outbound selection. Try another outbound option or check the airline directly."])],
  };
}

export type FlightBookingOption = {
  seller: string;
  price: number | null;
  currency: string;
  /** True when the outbound and return are issued as separate tickets. */
  separateTickets?: boolean;
  /** Provider prices for each separately issued leg, when supplied. */
  departingPrice?: number | null;
  returningPrice?: number | null;
  departingSeller?: string;
  returningSeller?: string;
  url?: string;
  /** Exact Google booking_request payload. It must be POSTed without re-encoding. */
  postData?: string;
  /** Exact route/date search to use if Google cannot resolve its opaque booking POST. */
  fallbackUrl?: string;
  type: string;
  baggage: string[];
  fareTerms: string[];
};

function makeGoogleFlightsFallbackUrl(input: TripSearchInput, originCode: string, destinationAirportCode: string, seller = ""): string {
  const query = [
    `round trip flights from ${originCode} to ${destinationAirportCode}`,
    `departing ${input.departureDate}`,
    `returning ${input.returnDate}`,
    `${input.adults} adults${input.childrenAges.length ? ` and ${input.childrenAges.length} children` : ""}`,
  ];
  if (seller && !/^booking provider$/i.test(seller)) query.push(`with ${seller}`);
  const url = new URL("https://www.google.com/travel/flights");
  url.searchParams.set("q", query.join(" "));
  url.searchParams.set("curr", input.currency);
  return url.toString();
}

export async function getFlightBookingOptions(
  bookingToken: string,
  input: TripSearchInput,
  destinationAirportCode: string,
  clientUsageKey = "shared",
  forceRefresh = false,
): Promise<SupplierOfferLookup<FlightBookingOption>> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!bookingToken || bookingToken.length > 12000) throw new Error("INVALID_BOOKING_TOKEN");
  const originCode = input.originAirportCode || resolveAirportCode(input.origin);
  if (!originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (!/^[A-Z]{3}$/.test(destinationAirportCode)) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");

  // Retain the original round-trip search context and replace the token with
  // the selected booking token. SerpApi currently validates outbound_date even
  // for some booking-token requests, so keep both original dates in the query.
  const params = makeFlightBookingParams(input, originCode, destinationAirportCode, bookingToken);
  const response = await querySerpApi(params, clientUsageKey, forceRefresh);
  const offers = arr(response.data.booking_options).map((item) => {
    const option = obj(item);
    const together = obj(option.together);
    const departing = obj(option.departing);
    const returning = obj(option.returning);
    // A single Continue action is valid only for a combined booking request.
    // Separate-ticket leg requests are not presented as one complete booking.
    const bookingRequest = obj(together.booking_request ?? option.booking_request);
    const rawDirectUrl = safeHttpUrl(together.link) ?? safeHttpUrl(option.link);
    const directUrl = rawDirectUrl && !/https?:\/\/(?:www\.)?google\.com\/travel\/clk\/f(?:[/?#]|$)/i.test(rawDirectUrl)
      ? rawDirectUrl
      : undefined;
    const googleUrl = safeGoogleBookingUrl(bookingRequest.url) ?? safeGoogleBookingUrl(option.link);
    const rawPostData = str(bookingRequest.post_data) || str(option.post_data) || str(together.post_data);
    const postData = rawPostData && rawPostData.length <= 30000 ? rawPostData : undefined;
    const postUrl = googleUrl && postData && option.separate_tickets !== true ? googleUrl : undefined;
    const legOnlyBooking = !bookingRequest.url && (Object.keys(departing).length > 0 || Object.keys(returning).length > 0);
    const separateTickets = option.separate_tickets === true || legOnlyBooking;
    const departingPrice = num(departing.price);
    const returningPrice = num(returning.price);
    const separateTicketSum = separateTickets && departingPrice !== null && returningPrice !== null
      ? departingPrice + returningPrice
      : null;
    const seller = str(together.book_with, str(option.book_with, "Booking provider"));
    const fallbackUrl = makeGoogleFlightsFallbackUrl(input, originCode, destinationAirportCode, seller);
    return {
      seller,
      price: num(together.price) ?? num(option.price) ?? separateTicketSum,
      currency: input.currency,
      separateTickets,
      departingPrice,
      returningPrice,
      departingSeller: str(departing.book_with) || undefined,
      returningSeller: str(returning.book_with) || undefined,
      // Never expose Google's /travel/clk/f endpoint as a normal GET link.
      // If a POST cannot be used, send the traveler to an exact route/date search.
      url: directUrl ?? postUrl ?? fallbackUrl,
      postData: directUrl || !postUrl ? undefined : postData,
      fallbackUrl,
      type: `${str(together.option_title, str(option.type, "Online booking"))}${separateTickets ? " · separate tickets" : ""}`,
      baggage: arr(together.baggage_prices).filter((entry): entry is string => typeof entry === "string").slice(0, 5),
      fareTerms: arr(together.extensions).filter((entry): entry is string => typeof entry === "string").slice(0, 6),
    };
  }).filter((item) => item.url).slice(0, 10);
  return {
    offers,
    checkedAt: new Date().toISOString(),
    dataAsOf: response.fetchedAt,
    servedFromCache: response.fromCache,
    stale: Boolean(response.isStale),
  };
}
