import { getProviderCache, getProviderCacheFallback, providerCacheKey, recordProviderEvent, reserveGeoapifyCredits, setProviderCache, waitForGeoapifyRequestSlot } from "@/lib/db/travel-cache";
import {
  buildGeoapifyPlacesUrl,
  buildGeoapifyRouteUrl,
  buildGeoapifyStaticMapUrl,
  estimateGeoapifyRouteCredits,
  normalizeGeoapifyPlaces,
  parseGeoapifyRoute,
  type GeoapifyKind,
  type GeoCoordinates,
  type GeoapifyPlace,
  type GeoapifyRoute,
} from "@/lib/trip-planner/geoapify-format";

type RecordValue = Record<string, unknown>;
export type GeoapifyPlacesResponse = {
  data: { local_results: Array<RecordValue> };
  fetchedAt: string;
  fromCache: boolean;
  isStale?: boolean;
  places: GeoapifyPlace[];
};
export type GeoapifyDrivingRouteResponse = GeoapifyRoute & {
  source: string;
  checkedAt: string;
  startAddress?: string;
  endAddress?: string;
  mapImageDataUrl?: string;
};

function apiKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  return key;
}

function asRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function normalizedData(places: GeoapifyPlace[]): { local_results: Array<RecordValue> } {
  return {
    local_results: places.map((place) => ({
      title: place.title,
      address: place.address,
      place_id: place.placeId,
      gps_coordinates: { latitude: place.latitude, longitude: place.longitude },
      type: place.category,
      website: place.website,
      opening_hours: place.openingHours,
      links: { directions: place.mapsUrl },
      data_source: place.source,
    })),
  };
}

function placesFromCached(payload: RecordValue): GeoapifyPlace[] {
  const rows = Array.isArray(payload.places) ? payload.places : [];
  return rows.filter((row) => {
    const place = asRecord(row);
    return typeof place.title === "string" && typeof place.latitude === "number" && typeof place.longitude === "number";
  }) as GeoapifyPlace[];
}

/** Draws a cached route as a static map without exposing the Geoapify key to the browser. */
async function renderGeoapifyRouteMap(input: {
  geometry: Array<[number, number]>;
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  apiKey: string;
  clientUsageKey: string;
}): Promise<string | undefined> {
  if (input.geometry.length < 2) return undefined;
  try {
    // A 700x380 image, two endpoint markers and a route line are reserved
    // at five credits to round up the provider's tile-based usage estimate.
    await reserveGeoapifyCredits(input.clientUsageKey, 5);
    const mapUrl = buildGeoapifyStaticMapUrl({
      geometry: input.geometry,
      origin: input.origin,
      destination: input.destination,
      apiKey: input.apiKey,
      width: 700,
      height: 380,
    });
    await waitForGeoapifyRequestSlot();
    const response = await fetch(mapUrl, {
      headers: { Accept: "image/png" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type")?.split(";")[0] || "image/png";
    if (!contentType.startsWith("image/")) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 1_500_000) return undefined;
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    // A map preview is an enhancement. A valid distance/time result should
    // still be returned when the optional static-map allowance is exhausted.
    return undefined;
  }
}

export async function searchGeoapifyPlaces(input: {
  center: GeoCoordinates;
  radiusMeters: number;
  kind: GeoapifyKind;
  clientUsageKey: string;
  forceRefresh?: boolean;
}): Promise<GeoapifyPlacesResponse> {
  const key = apiKey();
  const limit = 40;
  const cacheKey = providerCacheKey({
    provider: "geoapify-places-v1",
    kind: input.kind,
    latitude: input.center.latitude.toFixed(4),
    longitude: input.center.longitude.toFixed(4),
    radiusMeters: String(Math.round(input.radiusMeters / 250) * 250),
    limit: String(limit),
  });
  if (!input.forceRefresh) {
    const cached = await getProviderCache(cacheKey);
    if (cached) {
      const places = placesFromCached(cached.payload);
      await recordProviderEvent({ provider: "Geoapify", category: input.kind === "restaurant" ? "Places / restaurants" : "Places / activities", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
      return { data: normalizedData(places), fetchedAt: cached.fetchedAt, fromCache: true, places };
    }
  }

  const startedAt = Date.now();
  try {
    // Allocate a shared request slot, then reserve two credits conservatively
    // (one credit per 20 places returned, up to 40 requested).
    await waitForGeoapifyRequestSlot();
    await reserveGeoapifyCredits(input.clientUsageKey, 2);
    const url = buildGeoapifyPlacesUrl({ center: input.center, radiusMeters: input.radiusMeters, kind: input.kind, apiKey: key, limit });
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) {
      await recordProviderEvent({ provider: "Geoapify", category: input.kind === "restaurant" ? "Places / restaurants" : "Places / activities", eventType: "provider_error", outcome: "error", httpStatus: response.status, durationMs: Date.now() - startedAt });
      throw new Error(response.status === 429 ? "GEOAPIFY_PROVIDER_RATE_LIMITED" : `GEOAPIFY_HTTP_${response.status}`);
    }
    const payload = await response.json() as unknown;
    const places = normalizeGeoapifyPlaces(payload, input.kind);
    const data = normalizedData(places);
    await setProviderCache(cacheKey, { places, local_results: data.local_results }, 12 * 60 * 60);
    await recordProviderEvent({ provider: "Geoapify", category: input.kind === "restaurant" ? "Places / restaurants" : "Places / activities", eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
    return { data, fetchedAt: new Date().toISOString(), fromCache: false, places };
  } catch (error) {
    const code = error instanceof Error ? error.message : "GEOAPIFY_REQUEST_FAILED";
    if (code.startsWith("GEOAPIFY_DAILY_CAP") || code.startsWith("GEOAPIFY_CLIENT_DAILY_CAP") || code === "GEOAPIFY_REQUEST_RATE_LIMITED") {
      await recordProviderEvent({ provider: "Geoapify", category: input.kind === "restaurant" ? "Places / restaurants" : "Places / activities", eventType: "request_blocked", outcome: "blocked", cacheStatus: "miss" });
    }
    const stale = await getProviderCacheFallback(cacheKey, 7 * 24 * 60 * 60).catch(() => null);
    if (stale) {
      const places = placesFromCached(stale.payload);
      await recordProviderEvent({ provider: "Geoapify", category: input.kind === "restaurant" ? "Places / restaurants" : "Places / activities", eventType: "cache_hit", outcome: "success", cacheStatus: "stale" });
      return { data: normalizedData(places), fetchedAt: stale.fetchedAt, fromCache: true, isStale: true, places };
    }
    if (!code.startsWith("GEOAPIFY_DAILY_CAP") && !code.startsWith("GEOAPIFY_CLIENT_DAILY_CAP") && code !== "GEOAPIFY_REQUEST_RATE_LIMITED") {
      await recordProviderEvent({ provider: "Geoapify", category: input.kind === "restaurant" ? "Places / restaurants" : "Places / activities", eventType: "provider_error", outcome: "error", durationMs: Date.now() - startedAt });
    }
    throw error;
  }
}

export async function getGeoapifyDrivingRoute(input: {
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  originLabel?: string;
  destinationLabel?: string;
  clientUsageKey: string;
}): Promise<GeoapifyDrivingRouteResponse | null> {
  const key = apiKey();
  const cacheKey = providerCacheKey({
    provider: "geoapify-driving-route-v2",
    originLat: input.origin.latitude.toFixed(5), originLon: input.origin.longitude.toFixed(5),
    destinationLat: input.destination.latitude.toFixed(5), destinationLon: input.destination.longitude.toFixed(5),
  });
  const cached = await getProviderCache(cacheKey);
  if (cached) {
    const routeFeature = asRecord(cached.payload.route);
    const route = parseGeoapifyRoute({ features: [routeFeature] });
    if (route) {
      await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
      return {
        ...route,
        source: "Geoapify Routing / OpenStreetMap (estimated; no live traffic)",
        checkedAt: cached.fetchedAt,
        startAddress: input.originLabel,
        endAddress: input.destinationLabel,
        ...(typeof cached.payload.mapImageDataUrl === "string" ? { mapImageDataUrl: cached.payload.mapImageDataUrl } : {}),
      };
    }
  }

  const startedAt = Date.now();
  try {
    const estimatedCredits = estimateGeoapifyRouteCredits(input.origin, input.destination);
    await waitForGeoapifyRequestSlot();
    await reserveGeoapifyCredits(input.clientUsageKey, estimatedCredits);
    const url = buildGeoapifyRouteUrl({ origin: input.origin, destination: input.destination, apiKey: key });
    const response = await fetch(url, { headers: { Accept: "application/geo+json, application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) {
      await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "provider_error", outcome: "error", httpStatus: response.status, durationMs: Date.now() - startedAt });
      throw new Error(response.status === 429 ? "GEOAPIFY_PROVIDER_RATE_LIMITED" : `GEOAPIFY_HTTP_${response.status}`);
    }
    const payload = await response.json() as unknown;
    const route = parseGeoapifyRoute(payload);
    if (!route) return null;
    const root = asRecord(payload);
    const feature = Array.isArray(root.features) ? asRecord(root.features[0]) : {};
    if (!Object.keys(feature).length) return null;
    const mapImageDataUrl = await renderGeoapifyRouteMap({
      geometry: route.geometry,
      origin: input.origin,
      destination: input.destination,
      apiKey: key,
      clientUsageKey: input.clientUsageKey,
    });
    await setProviderCache(cacheKey, { route: feature, ...(mapImageDataUrl ? { mapImageDataUrl } : {}) }, 12 * 60 * 60);
    const checkedAt = new Date().toISOString();
    await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
    return {
      ...route,
      source: "Geoapify Routing / OpenStreetMap (estimated; no live traffic)",
      checkedAt,
      startAddress: input.originLabel,
      endAddress: input.destinationLabel,
      ...(mapImageDataUrl ? { mapImageDataUrl } : {}),
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "GEOAPIFY_ROUTE_FAILED";
    if (code.startsWith("GEOAPIFY_DAILY_CAP") || code.startsWith("GEOAPIFY_CLIENT_DAILY_CAP") || code === "GEOAPIFY_REQUEST_RATE_LIMITED") {
      await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "request_blocked", outcome: "blocked", cacheStatus: "miss" });
    } else {
      await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "provider_error", outcome: "error", durationMs: Date.now() - startedAt });
    }
    throw error;
  }
}
