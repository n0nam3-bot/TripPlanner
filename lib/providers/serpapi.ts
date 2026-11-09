import { getProviderCache, providerCacheKey, reserveProviderSearch, setProviderCache } from "@/lib/db/travel-cache";
import { resolveAirportCode } from "@/lib/trip-planner/airports";
import { AIRPORT_COORDINATES, destinationMetadata, getDestinationAreaGeo, getDestinationStateRegion, getUSStateAddressAliases, getUSStateRegion } from "@/lib/trip-planner/location-suggestions";
import type { TripSearchInput, TripComponent, StayType } from "@/lib/trip-planner/types";

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
  propertyType: string;
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
};

export type HotelBookingOption = { seller: string; price: number | null; currency: string; url?: string; terms: string[] };

export type LiveTravelSearchResult = {
  status: "live" | "partial" | "empty";
  provider: "SerpApi / Google Travel and Maps";
  checkedAt: string;
  dataAsOf: string;
  servedFromCache: boolean;
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
  return Boolean(metadata.country) && normalizeLocationText(metadata.city) === normalizeLocationText(metadata.country);
}

function destinationLocalityTokens(destinationName: string): string[] {
  const state = getDestinationStateRegion(destinationName);
  return destinationName.split(",").map(normalizeLocationText).filter((part) =>
    part.length >= 3 && part !== "united states" && (!state || part !== normalizeLocationText(state.name))
  );
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

  if (!airport && isCountryWideSearch(destinationName)) return Boolean(hotel.address);
  if (broadState) return Boolean(hotel.address) && addressMatchesState(normalizeLocationText(hotel.address), stateAliases);

  if (area) {
    if (hotel.latitude !== null && hotel.longitude !== null) {
      return milesBetween(area.latitude, area.longitude, hotel.latitude, hotel.longitude) <= area.hotelRadiusMiles;
    }
    return Boolean(hotel.address) && area.addressAliases.some((alias) => address.includes(normalizeLocationText(alias)));
  }

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

function normalizeHotel(item: unknown, index: number, currency: string, destinationName: string, checkIn: string, checkOut: string): LiveHotel | null {
  const hotel = obj(item);
  const name = str(hotel.name);
  if (!name) return null;
  const nightly = obj(hotel.rate_per_night);
  const total = obj(hotel.total_rate);
  const imageList = arr(hotel.images);
  const firstImage = obj(imageList[0]);
  const coordinates = obj(hotel.gps_coordinates);
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
    propertyType: str(hotel.type, "hotel"),
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
    amenities: arr(hotel.amenities).filter((item): item is string => typeof item === "string").slice(0, 8),
    freeCancellation: hotel.free_cancellation === true,
    image: safeHttpUrl(firstImage.thumbnail) ?? safeHttpUrl(hotel.thumbnail),
    bookingUrl: propertyUrl,
    bookingUrlLabel: officialWebsite ? "Official website" : propertyDetailsUrl ? "Property details" : mapUrl ? "View on Maps" : "View on Google Hotels",
    providerOffers,
  };
}

function expandOriginAirports(originCode: string): string {
  const metroAirports: Record<string, string> = {
    NYC: "JFK,EWR,LGA",
    CHI: "ORD,MDW",
    WAS: "DCA,IAD,BWI",
    LON: "LHR,LGW,STN,LTN",
    PAR: "CDG,ORY",
    ROM: "FCO,CIA",
    TYO: "HND,NRT",
  };
  return metroAirports[originCode] ?? originCode;
}

function makeFlightParams(input: TripSearchInput, originCode: string, destinationAirportCode: string): Record<string, string> {
  const classMap = { economy: "1", premium_economy: "2", business: "3", first: "4" } as const;
  // Google Flights exposes maximum-stop filters, not an exact one-stop/two-stop filter.
  const stopMap = { any: "0", nonstop: "1", one_stop: "2", two_stops: "3" } as const;
  return {
    engine: "google_flights",
    departure_id: expandOriginAirports(originCode),
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
  // Keep enough alternatives for airline preferences such as Delta vs JetBlue.
  return source.map((item, index) => normalizeFlight(item, index, currency)).filter((item): item is LiveFlight => Boolean(item)).slice(0, 16);
}

function makeHotelParams(input: TripSearchInput, destinationName: string, airportCode: string, stayType: StayType): Record<string, string> {
  const params: Record<string, string> = {
    engine: "google_hotels",
    q: `${stayType === "vacation_rentals" ? "Vacation rentals" : "Hotels"} in ${hotelSearchLocation(destinationName, airportCode)}`,
    check_in_date: input.departureDate,
    check_out_date: input.returnDate,
    adults: String(input.adults),
    children: String(input.childrenAges.length),
    currency: input.currency,
    gl: "us",
    hl: "en",
    sort_by: "3",
  };
  if (stayType === "vacation_rentals") params.vacation_rentals = "true";
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
      latitude: num(coords.latitude),
      longitude: num(coords.longitude),
      thumbnail: safeHttpUrl(place.thumbnail) ?? safeHttpUrl(place.serpapi_thumbnail),
      openState: str(place.open_state) || undefined,
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
    if (broadCountrySearch) return Boolean(address);
    if (broadState) return Boolean(address) && addressMatchesState(address, stateAliases);

    if (area) {
      if (item.latitude !== null && item.longitude !== null) {
        const limit = kind === "restaurant" ? area.restaurantRadiusMiles : area.activityRadiusMiles;
        return milesBetween(area.latitude, area.longitude, item.latitude, item.longitude) <= limit;
      }
      return Boolean(address) && area.addressAliases.some((alias) => address.includes(normalizeLocationText(alias)));
    }

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
): Promise<ProviderResponse> {
  const airport = AIRPORT_COORDINATES[destinationAirportCode];
  const area = getDestinationAreaGeo(destinationName);
  const mapsParams: Record<string, string> = {
    engine: "google_maps",
    type: "search",
    q: `${query} in ${destinationName}`,
    hl: "en",
    gl: "us",
  };
  if (area) mapsParams.ll = `@${area.latitude},${area.longitude},10z`;
  else if (airport) mapsParams.ll = `@${airport.latitude},${airport.longitude},12z`;

  let mapsResult: ProviderResponse | null = null;
  let mapsError: unknown = null;
  let mapEntries: unknown[] = [];
  let localCount = 0;
  try {
    mapsResult = await querySerpApi(mapsParams, 21600, clientUsageKey);
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
    // One or two local hits usually means Maps interpreted the query as a
    // tour operator/service search. Fall back unless it found a useful list.
    if (localCount >= 6) return mapsResult;
  } catch (error) {
    mapsError = error;
    const code = error instanceof Error ? error.message : "";
    if (["SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_PROVIDER_QUOTA_LOW", "SERPAPI_PROVIDER_HOURLY_LIMIT", "SERPAPI_QUOTA_CHECK_FAILED", "SERPAPI_CLIENT_RATE_LIMITED", "DATABASE_UNAVAILABLE", "DATABASE_NOT_CONFIGURED", "SERPAPI_NOT_CONFIGURED"].includes(code)) throw error;
  }

  try {
    // Keep the locality in the query and location parameter. This second
    // provider view can surface actual destination attractions when Maps
    // returns only a thin set or a tour operator located outside the area.
    const fallbackResult = await querySerpApi({
      engine: "google_local",
      q: `${query} in ${destinationName}`,
      location: destinationName,
      hl: "en",
      gl: "us",
    }, 21600, clientUsageKey);
    const fallbackEntries = [
      ...arr(fallbackResult.data.local_results),
      ...arr(fallbackResult.data.place_results),
      ...arr(fallbackResult.data.discover_more_places),
    ];
    if (mapsResult) {
      return {
        ...fallbackResult,
        data: { ...fallbackResult.data, local_results: [...mapEntries, ...fallbackEntries] },
      };
    }
    return fallbackResult;
  } catch (fallbackError) {
    if (mapsResult && localCount > 0) return mapsResult;
    if (mapsError) throw mapsError;
    throw fallbackError;
  }
}

export async function searchLiveTravel(input: TripSearchInput, destinationAirportCode: string, destinationName: string, clientUsageKey = "shared"): Promise<LiveTravelSearchResult> {
  if (!process.env.SERPAPI_API_KEY) throw new Error("SERPAPI_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  const components = input.components;
  const normalizedDestinationName = cleanDestinationSearchName(destinationName);
  const originCode = input.originAirportCode || resolveAirportCode(input.origin);
  const destinationCode = input.destinationAirportCode || destinationAirportCode;
  if (components.includes("flights") && !originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (components.includes("flights") && (!destinationCode || !/^[A-Z]{3}$/.test(destinationCode))) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");

  const tasks: Array<{ key: "flights" | "hotels" | "vacation_rentals" | "experiences" | "restaurants"; promise: Promise<ProviderResponse> }> = [];
  if (components.includes("flights")) tasks.push({ key: "flights", promise: querySerpApi(makeFlightParams(input, originCode!, destinationCode!), 3600, clientUsageKey) });
  if (components.includes("stays")) {
    for (const stayType of input.stayTypes) {
      tasks.push({ key: stayType === "hotels" ? "hotels" : "vacation_rentals", promise: querySerpApi(makeHotelParams(input, normalizedDestinationName, destinationCode || destinationAirportCode, stayType), 3600, clientUsageKey) });
    }
  }
  if (components.includes("activities")) {
    tasks.push({ key: "experiences", promise: searchPlacesWithFallback(experienceQueryForStyle(input.style), normalizedDestinationName, destinationCode || destinationAirportCode, "activity", clientUsageKey) });
    tasks.push({ key: "restaurants", promise: searchPlacesWithFallback("popular restaurants, highly rated local dining, casual restaurants and local food", normalizedDestinationName, destinationCode || destinationAirportCode, "restaurant", clientUsageKey) });
  }

  const outcomes = await Promise.allSettled(tasks.map((task) => task.promise));
  const errors = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected").map((outcome) => outcome.reason instanceof Error ? outcome.reason.message : "");
  const successfulCount = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
  if (successfulCount === 0 && errors.length) {
    const priority = ["SERPAPI_MONTHLY_CAP_REACHED", "SERPAPI_HOURLY_CAP_REACHED", "SERPAPI_PROVIDER_QUOTA_LOW", "SERPAPI_PROVIDER_HOURLY_LIMIT", "SERPAPI_QUOTA_CHECK_FAILED", "SERPAPI_CLIENT_RATE_LIMITED", "DATABASE_UNAVAILABLE", "DATABASE_NOT_CONFIGURED", "SERPAPI_NOT_CONFIGURED"];
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
  let providerSearchLinks: { flights?: string } = {};

  outcomes.forEach((outcome, index) => {
    const key = tasks[index].key;
    if (outcome.status === "rejected") {
      warnings.push(providerWarning(outcome.reason, key === "flights" ? "Flight search" : key === "experiences" ? "Things-to-do search" : key === "restaurants" ? "Restaurant search" : key === "vacation_rentals" ? "Vacation-rental search" : "Hotel search"));
      return;
    }
    fetchedAt.push(outcome.value.fetchedAt);
    cacheFlags.push(outcome.value.fromCache);
    if (key === "flights") {
      const metadata = obj(outcome.value.data.search_metadata);
      providerSearchLinks.flights = safeHttpUrl(metadata.google_flights_url);
      flights = normalizeFlights(outcome.value.data, input.currency);
      if (!flights.length) warnings.push("Google Flights returned no outbound options for this route and date combination. Try a different departure airport or open the route directly in Google Flights.");
    } else if (key === "hotels" || key === "vacation_rentals") {
      const properties = arr(outcome.value.data.properties);
      const normalized = properties.map((item, itemIndex) => normalizeHotel(item, itemIndex, input.currency, normalizedDestinationName, input.departureDate, input.returnDate)).filter((item): item is LiveHotel => Boolean(item));
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

  const uniqueHotels = [...new Map(hotels.map((item) => [item.id, item])).values()].slice(0, 18);
  const hasFlights = !components.includes("flights") || flights.length > 0;
  const hasStays = !components.includes("stays") || uniqueHotels.length > 0;
  const hasActivities = !components.includes("activities") || experiences.length > 0 || restaurants.length > 0;
  const fulfilledRequestedCategories = [hasFlights, hasStays, hasActivities].filter(Boolean).length;
  const status = fulfilledRequestedCategories === 0 ? "empty" : fulfilledRequestedCategories === components.length ? "live" : "partial";
  if (input.rooms > 1 && components.includes("stays")) warnings.push("The provider returned property-level prices but does not expose a confirmed multi-room allocation in this result. Open each property and reconfirm the exact room count and guest distribution before relying on the total.");
  if (input.childrenAges.length && components.includes("flights")) warnings.push("The flight provider applies child count but does not confirm age-specific fare rules here. Verify passenger ages and fares with the airline or seller.");
  return {
    status,
    provider: "SerpApi / Google Travel and Maps",
    checkedAt: new Date().toISOString(),
    dataAsOf: fetchedAt.sort()[0] ?? new Date().toISOString(),
    servedFromCache: cacheFlags.length > 0 && cacheFlags.every(Boolean),
    requested: components,
    flights,
    hotels: uniqueHotels,
    experiences: [...new Map([...experiences, ...restaurants].map((item) => [item.id, item])).values()],
    providerSearchLinks,
    warnings,
  };
}

export async function getHotelBookingOptions(propertyToken: string, input: TripSearchInput, clientUsageKey = "shared"): Promise<HotelBookingOption[]> {
  if (!process.env.SERPAPI_API_KEY) throw new Error("SERPAPI_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!propertyToken || propertyToken.length > 12000) throw new Error("INVALID_PROPERTY_TOKEN");
  const params: Record<string, string> = {
    engine: "google_hotels", property_token: propertyToken,
    check_in_date: input.departureDate, check_out_date: input.returnDate,
    adults: String(input.adults), children: String(input.childrenAges.length),
    currency: input.currency, gl: "us", hl: "en",
  };
  if (input.childrenAges.length) params.children_ages = input.childrenAges.join(",");
  const result = await querySerpApi(params, 3600, clientUsageKey);
  const candidates = [...arr(result.data.ads), ...arr(result.data.prices)];
  const offers = candidates.map((entry) => {
    const offer = obj(entry);
    const rate = obj(offer.rate_per_night);
    const total = obj(offer.total_rate);
    const price = num(total.extracted_after_taxes_fees) ?? num(total.extracted_lowest) ?? num(offer.extracted_price) ?? num(rate.extracted_after_taxes_fees) ?? num(rate.extracted_lowest) ?? num(offer.price);
    const link = safeHttpUrl(offer.link) ?? safeHttpUrl(offer.url);
    const terms = [...arr(offer.extensions), ...arr(offer.terms)].filter((value): value is string => typeof value === "string").slice(0, 5);
    return { seller: str(offer.name, str(offer.source, str(offer.provider, "Booking provider"))), price, currency: str(offer.currency, input.currency), url: link, terms };
  }).filter((offer) => Boolean(offer.url) || offer.price !== null);
  return [...new Map(offers.map((offer) => [`${offer.seller}:${offer.url ?? offer.price}`, offer])).values()].slice(0, 12);
}

export type DrivingRouteResult = { distance: string; duration: string; durationInTraffic?: string; startAddress?: string; endAddress?: string; source: string; checkedAt: string };

export async function getDrivingRoute(origin: string, destination: string, clientUsageKey = "shared"): Promise<DrivingRouteResult | null> {
  if (!process.env.SERPAPI_API_KEY) throw new Error("SERPAPI_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  const cleanOrigin = origin.trim().slice(0, 300);
  const cleanDestination = destination.trim().slice(0, 300);
  if (!cleanOrigin || !cleanDestination) throw new Error("INVALID_ROUTE_ENDPOINTS");
  const result = await querySerpApi({
    engine: "google_maps_directions",
    start_addr: cleanOrigin,
    end_addr: cleanDestination,
    travel_mode: "0",
    distance_unit: "1",
    hl: "en",
    gl: "us",
  }, 21600, clientUsageKey);
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
  if (!process.env.SERPAPI_API_KEY) throw new Error("SERPAPI_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!departureToken || departureToken.length > 12000) throw new Error("INVALID_DEPARTURE_TOKEN");
  const originCode = input.originAirportCode || resolveAirportCode(input.origin);
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
  /** Exact Google booking_request payload. It must be POSTed without re-encoding. */
  postData?: string;
  type: string;
  baggage: string[];
  fareTerms: string[];
};

function safeGoogleBookingUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "www.google.com" || host === "google.com") && url.pathname === "/travel/clk/f" ? url.toString() : undefined;
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
  const originCode = input.originAirportCode || resolveAirportCode(input.origin);
  if (!originCode) throw new Error("ORIGIN_AIRPORT_UNRESOLVED");
  if (!/^[A-Z]{3}$/.test(destinationAirportCode)) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");

  // Retain the original round-trip search context and replace the token with
  // the selected booking token. SerpApi currently validates outbound_date even
  // for some booking-token requests, so keep both original dates in the query.
  const original = makeFlightParams(input, originCode, destinationAirportCode);
  const params = {
    engine: "google_flights",
    type: original.type,
    departure_id: original.departure_id,
    arrival_id: original.arrival_id,
    outbound_date: original.outbound_date,
    return_date: original.return_date,
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
    const bookingRequest = obj(together.booking_request ?? option.booking_request);
    const rawDirectUrl = safeHttpUrl(option.link);
    const directUrl = rawDirectUrl && !/https?:\/\/(?:www\.)?google\.com\/travel\/clk\/f(?:[/?#]|$)/i.test(rawDirectUrl)
      ? rawDirectUrl
      : undefined;
    const googleUrl = safeGoogleBookingUrl(bookingRequest.url) ?? safeGoogleBookingUrl(option.link);
    const rawPostData = str(bookingRequest.post_data) || str(option.post_data) || str(together.post_data);
    const postData = rawPostData && rawPostData.length <= 30000 ? rawPostData : undefined;
    const postUrl = googleUrl && postData ? googleUrl : undefined;
    return {
      seller: str(together.book_with, str(option.book_with, "Booking provider")),
      price: num(together.price) ?? num(option.price),
      currency: input.currency,
      url: directUrl ?? postUrl,
      postData: directUrl ? undefined : postData,
      type: str(together.option_title, str(option.type, "Online booking")),
      baggage: arr(together.baggage_prices).filter((entry): entry is string => typeof entry === "string").slice(0, 5),
      fareTerms: arr(together.extensions).filter((entry): entry is string => typeof entry === "string").slice(0, 6),
    };
  }).filter((item) => item.url).slice(0, 10);
}
