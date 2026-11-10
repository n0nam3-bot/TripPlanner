import {
  getProviderCache,
  getProviderCacheFallback,
  providerCacheKey,
  recordProviderEvent,
  setProviderCache,
} from "@/lib/db/travel-cache";
import type { LiveHotel } from "@/lib/providers/serpapi";
import type { TripSearchInput, StayType } from "@/lib/trip-planner/types";
import { inferStaySpaceType } from "@/lib/providers/stay-features";
import { AIRPORT_COORDINATES, destinationMetadata, getDestinationAreaGeo, getUSStateRegion } from "@/lib/trip-planner/location-suggestions";

const DEFAULT_API_BASE = "https://demandapi.booking.com/3.3";
const APPROVED_API_BASES = new Set([
  "https://demandapi.booking.com/3.3",
  "https://demandapi-sandbox.booking.com/3.3",
]);
type JsonObject = Record<string, unknown>;
type BookingApiResult = { data: JsonObject; fetchedAt: string; fromCache: boolean; isStale?: boolean };
type BookingSearchResult = {
  hotels: LiveHotel[];
  fetchedAt: string;
  fromCache: boolean;
  isStale: boolean;
  warning?: string;
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
function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch { return undefined; }
}
function normalized(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function localizedName(value: unknown): string {
  if (typeof value === "string") return value;
  const names = obj(value);
  return str(names["en-us"], str(names["en-gb"], str(names.en, Object.values(names).find((entry): entry is string => typeof entry === "string") ?? "")));
}

const COUNTRY_CODES: Record<string, string> = {
  "united states": "us", "united kingdom": "gb", "dominican republic": "do", mexico: "mx", "puerto rico": "pr", aruba: "aw", jamaica: "jm",
  canada: "ca", portugal: "pt", spain: "es", france: "fr", italy: "it", germany: "de", netherlands: "nl", ireland: "ie", greece: "gr",
  japan: "jp", thailand: "th", australia: "au", "new zealand": "nz", iceland: "is", switzerland: "ch", austria: "at", belgium: "be",
  bahamas: "bs", barbados: "bb", "costa rica": "cr", panama: "pa", colombia: "co", brazil: "br", argentina: "ar", chile: "cl", peru: "pe",
  "south korea": "kr", india: "in", indonesia: "id", turkey: "tr", türkiye: "tr", "united arab emirates": "ae", "south africa": "za",
  croatia: "hr", czechia: "cz", denmark: "dk", norway: "no", sweden: "se", finland: "fi", poland: "pl", singapore: "sg", vietnam: "vn",
  philippines: "ph", malaysia: "my", egypt: "eg", morocco: "ma", israel: "il", cyprus: "cy", cuba: "cu", guatemala: "gt", honduras: "hn",
};

function countryCodeForDestination(destination: string): string | null {
  if (getUSStateRegion(destination)) return "us";
  const metadata = destinationMetadata(destination);
  const parts = destination.split(",").map((part) => part.trim()).filter(Boolean);
  const countryName = metadata.country || (parts.length > 1 ? parts[parts.length - 1] : "");
  const normalizedCountry = normalized(countryName);
  if (/^[a-z]{2}$/.test(countryName)) return countryName.toLowerCase();
  return COUNTRY_CODES[normalizedCountry] ?? null;
}

function destinationQuery(destination: string): string {
  const parts = destination.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts[0];
  const metadata = destinationMetadata(destination);
  return metadata.city || destination.trim();
}

function cachePolicy(input: TripSearchInput): { searchTtl: number; searchStale: number } {
  const days = Math.floor((Date.parse(`${input.departureDate}T00:00:00Z`) - Date.now()) / 86400000);
  if (days <= 7) return { searchTtl: 30 * 60, searchStale: 12 * 3600 };
  if (days <= 30) return { searchTtl: 2 * 3600, searchStale: 24 * 3600 };
  return { searchTtl: 6 * 3600, searchStale: 72 * 3600 };
}

function apiBase(): string {
  const configured = (process.env.BOOKING_COM_API_BASE || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
  if (!APPROVED_API_BASES.has(configured)) throw new Error("BOOKING_COM_INVALID_API_BASE");
  return configured;
}

function apiCredentials(): { token: string; affiliateId: string } | null {
  const token = process.env.BOOKING_COM_API_TOKEN?.trim();
  const affiliateId = process.env.BOOKING_COM_AFFILIATE_ID?.trim();
  if (!token || !affiliateId || !/^\d+$/.test(affiliateId)) return null;
  return { token, affiliateId };
}

export function isBookingComConfigured(): boolean {
  return apiCredentials() !== null;
}

async function callBookingApi(
  path: string,
  category: string,
  payload: JsonObject,
  ttlSeconds: number,
  staleMaxAgeSeconds: number,
  forceRefresh: boolean,
): Promise<BookingApiResult> {
  const credentials = apiCredentials();
  if (!credentials) throw new Error("BOOKING_COM_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");

  const baseUrl = apiBase();
  const cacheKey = providerCacheKey({ provider: "booking-com-demand-v3.3", baseUrl, path, payload: JSON.stringify(payload) });
  const startedAt = Date.now();
  let staleCandidate: Awaited<ReturnType<typeof getProviderCacheFallback>> = null;
  try {
    const cached = await getProviderCache(cacheKey);
    if (cached && !forceRefresh) {
      await recordProviderEvent({ provider: "Booking.com", category, eventType: "cache_hit", outcome: "success", cacheStatus: "hit", durationMs: Date.now() - startedAt });
      return { data: cached.payload, fetchedAt: cached.fetchedAt, fromCache: true };
    }
    staleCandidate = await getProviderCacheFallback(cacheKey, staleMaxAgeSeconds);
  } catch {
    throw new Error("DATABASE_UNAVAILABLE");
  }

  let providerErrorRecorded = false;
  try {
    const response = await fetch(`${baseUrl}/${path.replace(/^\//, "")}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        "X-Affiliate-Id": credentials.affiliateId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const data = obj(await response.json().catch(() => ({})));
    if (!response.ok || data.error || data.errors) {
      await recordProviderEvent({ provider: "Booking.com", category, eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      providerErrorRecorded = true;
      throw new Error(`BOOKING_COM_HTTP_${response.status}`);
    }
    try {
      await setProviderCache(cacheKey, data, ttlSeconds);
    } catch {
      await recordProviderEvent({ provider: "Booking.com", category, eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      return { data, fetchedAt: new Date().toISOString(), fromCache: false };
    }
    await recordProviderEvent({ provider: "Booking.com", category, eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
    return { data, fetchedAt: new Date().toISOString(), fromCache: false };
  } catch (error) {
    if (!providerErrorRecorded) {
      await recordProviderEvent({ provider: "Booking.com", category, eventType: "provider_error", outcome: "error", cacheStatus: "miss", durationMs: Date.now() - startedAt });
    }
    if (staleCandidate) {
      await recordProviderEvent({ provider: "Booking.com", category, eventType: "cache_hit", outcome: "success", cacheStatus: "stale", durationMs: Date.now() - startedAt });
      return { data: staleCandidate.payload, fetchedAt: staleCandidate.fetchedAt, fromCache: true, isStale: true };
    }
    throw error;
  }
}

async function resolveLocation(
  destination: string,
  airportCode: string,
  forceRefresh: boolean,
): Promise<{ selector: JsonObject; cache?: BookingApiResult }> {
  const area = getDestinationAreaGeo(destination);
  if (area) {
    return { selector: { coordinates: { latitude: area.latitude, longitude: area.longitude, radius: Math.min(100, Math.max(5, Math.round(area.hotelRadiusMiles * 1.60934))) } } };
  }

  const searchCountry = countryCodeForDestination(destination);
  const query = destinationQuery(destination).slice(0, 120);
  if (searchCountry && query.length >= 3) {
    const autocomplete = await callBookingApi(
      "common/autocomplete",
      "Accommodation destination lookup",
      { query, country: searchCountry, language: "en-us", filters: { types: ["city", "region"] } },
      86400,
      7 * 86400,
      forceRefresh,
    );
    const suggestions = arr(autocomplete.data.data).map(obj);
    const exact = suggestions.find((suggestion) => normalized(localizedName(suggestion.name)) === normalized(query));
    const selected = exact ?? suggestions.find((suggestion) => ["city", "region"].includes(str(suggestion.type))) ?? suggestions[0];
    if (selected) {
      const id = num(selected.id);
      const type = str(selected.type);
      if (id !== null && Number.isInteger(id) && (type === "city" || type === "region")) {
        return { selector: type === "city" ? { city: id } : { region: id }, cache: autocomplete };
      }
    }
    if (airportCode && AIRPORT_COORDINATES[airportCode]) {
      const point = AIRPORT_COORDINATES[airportCode];
      return { selector: { coordinates: { latitude: point.latitude, longitude: point.longitude, radius: 35 } }, cache: autocomplete };
    }
    throw new Error("BOOKING_COM_DESTINATION_NOT_FOUND");
  }

  if (airportCode && AIRPORT_COORDINATES[airportCode]) {
    const point = AIRPORT_COORDINATES[airportCode];
    return { selector: { coordinates: { latitude: point.latitude, longitude: point.longitude, radius: 35 } } };
  }
  throw new Error("BOOKING_COM_DESTINATION_NOT_FOUND");
}

function getTypeName(row: JsonObject): string {
  return localizedName(row.name) || str(row.description, localizedName(row.name_localized));
}

function typeIdsForStayTypes(data: JsonObject, stayTypes: StayType[]): { ids: number[]; labels: Map<number, string> } {
  const labels = new Map<number, string>();
  const hotelIds: number[] = [];
  const rentalIds: number[] = [];
  for (const raw of arr(data.accommodation_types)) {
    const row = obj(raw);
    const id = num(row.id);
    const name = getTypeName(row);
    if (id === null || !Number.isInteger(id) || !name) continue;
    labels.set(id, name);
    const value = normalized(name);
    if (/hotel|motel|resort|hostel|inn|aparthotel|capsule|bed and breakfast|guest house/.test(value)) hotelIds.push(id);
    if (/apartment|villa|holiday home|vacation home|chalet|bungalow|cabin|lodge|country house|homestay|farm stay|mobile home|camping|boat|tent/.test(value)) rentalIds.push(id);
  }
  if (stayTypes.length !== 1) return { ids: [], labels };
  return { ids: stayTypes[0] === "hotels" ? hotelIds : rentalIds, labels };
}

function propertyBookingUrl(raw: JsonObject, destination: string, input: TripSearchInput): string {
  const direct = safeUrl(raw.url) ?? safeUrl(raw.deep_link_url);
  if (direct) return direct;
  const fallback = new URL("https://www.booking.com/searchresults.html");
  fallback.searchParams.set("ss", destination);
  fallback.searchParams.set("checkin", input.departureDate);
  fallback.searchParams.set("checkout", input.returnDate);
  fallback.searchParams.set("group_adults", String(input.adults));
  fallback.searchParams.set("no_rooms", String(input.rooms));
  if (input.childrenAges.length) {
    fallback.searchParams.set("group_children", String(input.childrenAges.length));
    fallback.searchParams.set("age", input.childrenAges.join(","));
  }
  return fallback.toString();
}

function mapHotels(
  searchRows: unknown[],
  detailRows: unknown[],
  typeLabels: Map<number, string>,
  destination: string,
  input: TripSearchInput,
): LiveHotel[] {
  const searchById = new Map<string, JsonObject>();
  for (const raw of searchRows) {
    const row = obj(raw);
    const id = String(row.id ?? "");
    if (id) searchById.set(id, row);
  }
  const nights = Math.max(1, Math.round((Date.parse(`${input.returnDate}T00:00:00Z`) - Date.parse(`${input.departureDate}T00:00:00Z`)) / 86400000));
  const results: LiveHotel[] = [];
  for (const [index, raw] of detailRows.entries()) {
    const detail = obj(raw);
    const id = String(detail.id ?? "");
    const search = searchById.get(id);
    if (!id || !search) continue;
    const name = localizedName(detail.name);
    if (!name) continue;
    const location = obj(detail.location);
    const coordinates = obj(location.coordinates);
    const addressParts = [location.address, location.city, location.postal_code, location.country].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    const address = [...new Set(addressParts)].join(", ");
    const price = obj(search.price);
    const total = obj(price.total);
    const display = obj(price.display);
    const totalPrice = num(total.booker_currency) ?? num(total.accommodation_currency) ?? num(display.booker_currency) ?? num(display.accommodation_currency);
    const currency = str(obj(search.currency).booker, str(obj(search.currency).accommodation, input.currency));
    const ratingData = obj(detail.rating);
    const rating = num(ratingData.review_score) ?? num(ratingData.score) ?? num(detail.review_score);
    const reviews = num(ratingData.number_of_reviews) ?? num(ratingData.review_count) ?? num(detail.number_of_reviews);
    const typeId = num(detail.accommodation_type);
    const propertyType = typeId !== null ? (typeLabels.get(typeId) ?? "Accommodation") : "Accommodation";
    const inventoryType: StayType = /\b(hotel|resort|inn|motel|hostel)\b/i.test(propertyType) ? "hotels" : "vacation_rentals";
    const description = localizedName(detail.description) || undefined;
    const amenities = arr(detail.facilities).map((entry) => {
      const facility = obj(entry);
      return localizedName(facility.name) || str(facility.description);
    }).filter(Boolean);
    const essentialInfo: string[] = [];
    const products = arr(search.products).map(obj);
    const cancellation = obj(obj(products[0]).policies).cancellation;
    const cancellationData = obj(cancellation);
    const freeCancellation = str(cancellationData.type) === "free_cancellation" || Boolean(cancellationData.free_cancellation_until);
    const photos = arr(detail.photos).map(obj);
    const firstPhoto = obj(photos[0]);
    const image = safeUrl(firstPhoto.url_max750) ?? safeUrl(firstPhoto.url) ?? safeUrl(firstPhoto.url_original);
    const bookingUrl = propertyBookingUrl(search, destination, input);
    results.push({
      id: `booking-${id}-${index}`,
      name,
      source: "Booking.com",
      propertyType,
      inventoryTypes: [inventoryType],
      spaceType: inferStaySpaceType({ propertyType, essentialInfo, description }),
      description,
      essentialInfo,
      excludedAmenities: [],
      latitude: num(coordinates.latitude),
      longitude: num(coordinates.longitude),
      nearbyPlaces: [],
      rating,
      reviews,
      nightlyPrice: totalPrice !== null ? totalPrice / nights : null,
      totalPrice,
      currency,
      address,
      amenities: amenities.slice(0, 40),
      freeCancellation,
      image,
      bookingUrl,
      bookingUrlLabel: "Book on Booking.com",
      providerOffers: totalPrice !== null ? [{ seller: "Booking.com", price: totalPrice, priceBasis: "stay" as const, currency, url: bookingUrl }] : [],
    });
  }
  return results;
}

export async function searchBookingComAccommodations(
  input: TripSearchInput,
  destination: string,
  airportCode: string,
  forceRefresh = false,
): Promise<BookingSearchResult | null> {
  if (!apiCredentials()) return null;

  try {
    const { searchTtl, searchStale } = cachePolicy(input);
    const bookerCountry = (process.env.BOOKING_COM_BOOKER_COUNTRY || "us").trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(bookerCountry)) throw new Error("BOOKING_COM_INVALID_BOOKER_COUNTRY");

    const location = await resolveLocation(destination, airportCode, forceRefresh);
    const constantsResult = await callBookingApi(
      "accommodations/constants",
      "Accommodation type constants",
      { constants: ["accommodation_types"], languages: ["en-us"] },
      86400,
      7 * 86400,
      forceRefresh,
    );
    const types = typeIdsForStayTypes(obj(constantsResult.data.data), input.stayTypes);
    if (input.stayTypes.length === 1 && types.ids.length === 0) {
      throw new Error("BOOKING_COM_STAY_TYPE_UNAVAILABLE");
    }

    const guests: JsonObject = {
      number_of_adults: input.adults,
      number_of_rooms: input.rooms,
    };
    if (input.childrenAges.length) guests.children = input.childrenAges;
    const payload: JsonObject = {
      booker: { country: bookerCountry, platform: "desktop" },
      checkin: input.departureDate,
      checkout: input.returnDate,
      guests,
      currency: input.currency,
      extras: ["extra_charges", "products"],
      rows: 20,
      sort: { by: "price", direction: "ascending" },
      ...location.selector,
    };
    if (types.ids.length) payload.filters = { accommodation_types: types.ids };

    const search = await callBookingApi("accommodations/search", "Accommodation search", payload, searchTtl, searchStale, forceRefresh);
    const searchRows = arr(search.data.data);
    const ids = searchRows.map((entry) => num(obj(entry).id)).filter((id): id is number => id !== null && Number.isInteger(id) && id > 0).slice(0, 30);
    if (!ids.length) {
      return {
        hotels: [], fetchedAt: search.fetchedAt,
        fromCache: search.fromCache && constantsResult.fromCache && (!location.cache || location.cache.fromCache),
        isStale: Boolean(search.isStale || constantsResult.isStale || location.cache?.isStale),
      };
    }

    const detail = await callBookingApi(
      "accommodations/details",
      "Accommodation property details",
      { accommodations: ids, extras: ["photos", "facilities"], languages: ["en-us"] },
      86400,
      7 * 86400,
      forceRefresh,
    );
    const hotels = mapHotels(searchRows, arr(detail.data.data), types.labels, destination, input);
    const fetchedAt = [search.fetchedAt, detail.fetchedAt, constantsResult.fetchedAt, location.cache?.fetchedAt]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? new Date().toISOString();
    return {
      hotels,
      fetchedAt,
      fromCache: search.fromCache && detail.fromCache && constantsResult.fromCache && (!location.cache || location.cache.fromCache),
      isStale: Boolean(search.isStale || detail.isStale || constantsResult.isStale || location.cache?.isStale),
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const warning = code === "BOOKING_COM_HTTP_401" || code === "BOOKING_COM_HTTP_403"
      ? "Booking.com access was rejected. Verify that your Demand API partner access, API token and Affiliate ID are active."
      : code === "BOOKING_COM_DESTINATION_NOT_FOUND"
        ? "Booking.com could not resolve this destination. Google Hotels results remain available."
        : code === "BOOKING_COM_STAY_TYPE_UNAVAILABLE"
          ? "Booking.com could not map the selected accommodation type. Google Hotels results remain available."
          : code === "BOOKING_COM_INVALID_API_BASE"
            ? "Booking.com API endpoint is invalid. Use the official v3.3 production or sandbox endpoint."
            : "Booking.com accommodation search is temporarily unavailable. Google Hotels results remain available.";
    return { hotels: [], fetchedAt: new Date().toISOString(), fromCache: false, isStale: false, warning };
  }
}
