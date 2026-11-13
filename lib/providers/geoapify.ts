import { getGeoapifyCreditUsageSnapshot, getProviderCache, getProviderCacheFallback, providerCacheKey, recordProviderEvent, reserveGeoapifyCredits, setProviderCache, waitForGeoapifyRequestSlot } from "@/lib/db/travel-cache";
import {
  buildGeoapifyPlacesUrl,
  buildGeoapifyRouteUrl,
  buildGeoapifyStaticMapRequest,
  describeGeoapifyMapFailure,
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
  mapWarning?: string;
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
    if (code.startsWith("GEOAPIFY_DAILY_CAP") || code.startsWith("GEOAPIFY_CLIENT_DAILY_CAP") || code.startsWith("GEOAPIFY_DAILY_GATE_INCONSISTENT") || code.startsWith("GEOAPIFY_CLIENT_GATE_INCONSISTENT") || code === "GEOAPIFY_REQUEST_RATE_LIMITED") {
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

async function renderGeoapifyRouteMap(input: {
  route: GeoapifyRoute;
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  clientUsageKey: string;
  apiKey: string;
}): Promise<string> {
  const request = buildGeoapifyStaticMapRequest({
    geometry: input.route.geometry,
    polyline6: input.route.polyline6,
    origin: input.origin,
    destination: input.destination,
    apiKey: input.apiKey,
  });
  // Geoapify's documented 800x450 + two-marker render is approximately
  // 4–5 credits. Reserve five to protect the shared key from overuse.
  await waitForGeoapifyRequestSlot();
  await reserveGeoapifyCredits(input.clientUsageKey, 5);
  const response = await fetch(request.url, {
    method: "POST",
    headers: { Accept: "image/jpeg,image/png", "Content-Type": "application/json" },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GEOAPIFY_STATIC_MAP_HTTP_${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (contentType !== "image/jpeg" && contentType !== "image/png") throw new Error("GEOAPIFY_STATIC_MAP_NOT_IMAGE");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 2_500_000) throw new Error("GEOAPIFY_STATIC_MAP_INVALID_SIZE");
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

const GEOAPIFY_MAP_PREVIEW_VERSION = "route-map-v3";
type MapAttempt = { mapImageDataUrl?: string; mapWarning?: string; mapRetryAt?: string };

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "GEOAPIFY_STATIC_MAP_FAILED";
}

function nextUtcReset(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

async function attemptGeoapifyMapPreview(input: {
  route: GeoapifyRoute;
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  clientUsageKey: string;
  apiKey: string;
}): Promise<MapAttempt> {
  const startedAt = Date.now();
  try {
    const mapImageDataUrl = await renderGeoapifyRouteMap(input);
    await recordProviderEvent({
      provider: "Geoapify", category: "Route map preview", eventType: "provider_request",
      outcome: "success", cacheStatus: "miss", httpStatus: 200, durationMs: Date.now() - startedAt,
    });
    return { mapImageDataUrl };
  } catch (error) {
    const code = errorCode(error);
    const needsUsageSnapshot = code === "GEOAPIFY_DAILY_CAP_REACHED"
      || code === "GEOAPIFY_CLIENT_DAILY_CAP_REACHED"
      || code === "GEOAPIFY_DAILY_GATE_INCONSISTENT"
      || code === "GEOAPIFY_CLIENT_GATE_INCONSISTENT"
      || code === "GEOAPIFY_STATIC_MAP_HTTP_429";
    const usage = needsUsageSnapshot
      ? await getGeoapifyCreditUsageSnapshot(input.clientUsageKey).catch(() => null)
      : null;
    const failure = describeGeoapifyMapFailure(code, usage);
    const mapRetryAt = failure.retryDelayMs === null
      ? nextUtcReset()
      : new Date(Date.now() + failure.retryDelayMs).toISOString();

    await recordProviderEvent({
      provider: "Geoapify", category: "Route map preview",
      eventType: failure.blocked ? "request_blocked" : "provider_error",
      outcome: failure.blocked ? "blocked" : "error", cacheStatus: "miss",
      httpStatus: failure.httpStatus, durationMs: Date.now() - startedAt,
    }).catch(() => undefined);
    return { mapWarning: failure.warning, mapRetryAt };
  }
}

export async function getGeoapifyDrivingRoute(input: {
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  originLabel?: string;
  destinationLabel?: string;
  clientUsageKey: string;
  forceMapRefresh?: boolean;
}): Promise<GeoapifyDrivingRouteResponse | null> {
  const key = apiKey();
  const cacheKey = providerCacheKey({
    provider: "geoapify-driving-route-v2",
    originLat: input.origin.latitude.toFixed(5), originLon: input.origin.longitude.toFixed(5),
    destinationLat: input.destination.latitude.toFixed(5), destinationLon: input.destination.longitude.toFixed(5),
  });
  const cached = await getProviderCache(cacheKey);
  if (cached) {
    const route = parseGeoapifyRoute({ results: [cached.payload.route] });
    if (route) {
      await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
      let mapImageDataUrl = typeof cached.payload.mapImageDataUrl === "string" && cached.payload.mapImageDataUrl.startsWith("data:image/") ? cached.payload.mapImageDataUrl : undefined;
      let mapWarning = typeof cached.payload.mapWarning === "string" ? cached.payload.mapWarning : undefined;
      let mapRetryAt = typeof cached.payload.mapRetryAt === "string" ? cached.payload.mapRetryAt : undefined;
      const retryTime = mapRetryAt ? new Date(mapRetryAt).getTime() : 0;
      const cachedMapVersion = typeof cached.payload.mapPreviewVersion === "string" ? cached.payload.mapPreviewVersion : "";
      const legacyMapFailure = cachedMapVersion !== GEOAPIFY_MAP_PREVIEW_VERSION;
      // Older deployments could cache a false daily-cap warning for the full
      // route-cache TTL. Retry that legacy failure once using the cached route
      // geometry, without spending credits on another routing request. Newer
      // failures observe their retry window to protect the Geoapify allowance.
      const retryWindowElapsed = !retryTime || !Number.isFinite(retryTime) || Date.now() >= retryTime;
      if (!mapImageDataUrl && route.geometry.length >= 2 && (input.forceMapRefresh || legacyMapFailure || retryWindowElapsed)) {
        const map = await attemptGeoapifyMapPreview({
          route, origin: input.origin, destination: input.destination,
          clientUsageKey: input.clientUsageKey, apiKey: key,
        });
        mapImageDataUrl = map.mapImageDataUrl;
        mapWarning = map.mapWarning;
        mapRetryAt = map.mapRetryAt;
        await setProviderCache(cacheKey, {
          ...cached.payload,
          mapImageDataUrl: mapImageDataUrl ?? null,
          mapWarning: mapWarning ?? null,
          mapRetryAt: mapRetryAt ?? null,
          mapPreviewVersion: GEOAPIFY_MAP_PREVIEW_VERSION,
          directions: route.directions,
        }, 12 * 60 * 60).catch(() => undefined);
      }
      const cachedDirections = Array.isArray(cached.payload.directions)
        ? cached.payload.directions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 16)
        : route.directions;
      return {
        ...route,
        directions: cachedDirections,
        ...(mapImageDataUrl ? { mapImageDataUrl } : {}),
        ...(mapWarning ? { mapWarning } : {}),
        source: "Geoapify Routing / OpenStreetMap (estimated; no live traffic)",
        checkedAt: cached.fetchedAt,
        startAddress: input.originLabel,
        endAddress: input.destinationLabel,
      };
    }
  }

  const startedAt = Date.now();
  try {
    const estimatedCredits = estimateGeoapifyRouteCredits(input.origin, input.destination);
    await waitForGeoapifyRequestSlot();
    await reserveGeoapifyCredits(input.clientUsageKey, estimatedCredits);
    const url = buildGeoapifyRouteUrl({ origin: input.origin, destination: input.destination, apiKey: key });
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) {
      await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "provider_error", outcome: "error", httpStatus: response.status, durationMs: Date.now() - startedAt });
      throw new Error(response.status === 429 ? "GEOAPIFY_PROVIDER_RATE_LIMITED" : `GEOAPIFY_HTTP_${response.status}`);
    }
    const payload = await response.json() as unknown;
    const route = parseGeoapifyRoute(payload);
    if (!route) return null;
    const record = asRecord(payload);
    const first = Array.isArray(record.results) ? asRecord(record.results[0]) : {};
    let mapResult: MapAttempt = {};
    if (route.polyline6 || route.geometry.length >= 2) {
      mapResult = await attemptGeoapifyMapPreview({
        route, origin: input.origin, destination: input.destination,
        clientUsageKey: input.clientUsageKey, apiKey: key,
      });
    } else {
      mapResult = { mapWarning: "The routing response did not include drawable road geometry, so a map preview could not be generated." };
    }
    await setProviderCache(cacheKey, {
      route: first,
      mapImageDataUrl: mapResult.mapImageDataUrl ?? null,
      directions: route.directions,
      mapWarning: mapResult.mapWarning ?? null,
      mapRetryAt: mapResult.mapRetryAt ?? null,
      mapPreviewVersion: GEOAPIFY_MAP_PREVIEW_VERSION,
    }, 12 * 60 * 60).catch(() => undefined);
    const checkedAt = new Date().toISOString();
    await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "provider_request", outcome: "success", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
    return {
      ...route,
      ...(mapResult.mapImageDataUrl ? { mapImageDataUrl: mapResult.mapImageDataUrl } : {}),
      ...(mapResult.mapWarning ? { mapWarning: mapResult.mapWarning } : {}),
      source: "Geoapify Routing / OpenStreetMap (estimated; no live traffic)",
      checkedAt,
      startAddress: input.originLabel,
      endAddress: input.destinationLabel,
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "GEOAPIFY_ROUTE_FAILED";
    if (code.startsWith("GEOAPIFY_DAILY_CAP") || code.startsWith("GEOAPIFY_CLIENT_DAILY_CAP") || code.startsWith("GEOAPIFY_DAILY_GATE_INCONSISTENT") || code.startsWith("GEOAPIFY_CLIENT_GATE_INCONSISTENT") || code === "GEOAPIFY_REQUEST_RATE_LIMITED") {
      await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "request_blocked", outcome: "blocked", cacheStatus: "miss" });
    } else {
      await recordProviderEvent({ provider: "Geoapify", category: "Driving directions", eventType: "provider_error", outcome: "error", durationMs: Date.now() - startedAt });
    }
    throw error;
  }
}
