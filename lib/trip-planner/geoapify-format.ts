export type GeoapifyKind = "activity" | "restaurant";
export type GeoCoordinates = { latitude: number; longitude: number };
export type GeoapifyPlace = {
  title: string;
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
  category: string;
  website?: string;
  openingHours?: string;
  mapsUrl: string;
  source: "Geoapify / OpenStreetMap";
};
export type GeoapifyRoute = {
  distance: string;
  duration: string;
  durationSeconds: number;
  distanceMeters: number;
};

export type GeoapifyCreditCaps = { dailyCap: number; clientDailyCap: number };

function boundedCap(value: unknown, fallback: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(parsed) ? Math.max(1, Math.min(maximum, parsed)) : fallback;
}

/** Resolve the same hard safety limits for the request gate, health endpoint and admin dashboard. */
export function resolveGeoapifyCreditCaps(input: { dailyCap?: unknown; clientDailyCap?: unknown } = {}): GeoapifyCreditCaps {
  return {
    dailyCap: boundedCap(input.dailyCap, 2400, 2800),
    clientDailyCap: boundedCap(input.clientDailyCap, 80, 300),
  };
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function safeHttps(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try { const url = new URL(raw); return url.protocol === "https:" ? url.toString() : undefined; } catch { return undefined; }
}

export function geoapifyCategories(kind: GeoapifyKind): string[] {
  return kind === "restaurant"
    ? ["catering.restaurant", "catering.cafe", "catering.fast_food"]
    : ["tourism.attraction", "tourism.sights", "entertainment", "leisure.park", "activity"];
}

export function buildGeoapifyPlacesUrl(input: {
  center: GeoCoordinates;
  radiusMeters: number;
  kind: GeoapifyKind;
  apiKey: string;
  countryCode?: string;
  limit?: number;
}): string {
  const { center } = input;
  if (!Number.isFinite(center.latitude) || center.latitude < -90 || center.latitude > 90 || !Number.isFinite(center.longitude) || center.longitude < -180 || center.longitude > 180) {
    throw new Error("INVALID_GEOAPIFY_COORDINATES");
  }
  if (!input.apiKey.trim()) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  const radiusMeters = Math.max(500, Math.min(100_000, Math.round(input.radiusMeters)));
  const limit = Math.max(1, Math.min(40, Math.floor(input.limit ?? 40)));
  const countryCode = input.countryCode?.trim().toLowerCase();
  if (countryCode && !/^[a-z]{2}$/.test(countryCode)) throw new Error("INVALID_GEOAPIFY_COUNTRY_CODE");
  const params = new URLSearchParams({
    categories: geoapifyCategories(input.kind).join(","),
    filter: countryCode ? `countrycode:${countryCode}` : `circle:${center.longitude},${center.latitude},${radiusMeters}`,
    bias: countryCode ? `circle:${center.longitude},${center.latitude},${radiusMeters}` : `proximity:${center.longitude},${center.latitude}`,
    limit: String(limit),
    lang: "en",
    apiKey: input.apiKey.trim(),
  });
  return `https://api.geoapify.com/v2/places?${params.toString()}`;
}

export function normalizeGeoapifyPlaces(payload: unknown, kind: GeoapifyKind): GeoapifyPlace[] {
  const root = record(payload);
  const features = Array.isArray(root.features) ? root.features : [];
  const normalized = features.map<GeoapifyPlace | null>((feature, index) => {
    const properties = record(record(feature).properties);
    const name = text(properties.name) || text(properties.address_line1);
    const latitude = finite(properties.lat);
    const longitude = finite(properties.lon);
    if (!name || latitude === null || longitude === null) return null;
    const address = text(properties.formatted)
      || [text(properties.address_line1), text(properties.address_line2)].filter(Boolean).join(", ")
      || text(properties.datasource && record(properties.datasource).raw && record(record(properties.datasource).raw).name);
    const categories = Array.isArray(properties.categories) ? properties.categories.filter((value): value is string => typeof value === "string") : [];
    const sourceData = record(properties.datasource);
    const sourceRaw = record(sourceData.raw);
    const placeId = text(properties.place_id) || text(properties.datasource && record(properties.datasource).raw && record(record(properties.datasource).raw).osm_id) || `${kind}-${index}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`;
    const mapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(latitude))}&mlon=${encodeURIComponent(String(longitude))}#map=17/${latitude}/${longitude}`;
    const category = categories.slice(0, 3).map((value) => value.replace(/\./g, " · ")).join(" / ") || (kind === "restaurant" ? "Restaurant or cafe" : "Attraction or activity");
    const website = safeHttps(properties.website) ?? safeHttps(sourceRaw.website);
    const openingHours = text(properties.opening_hours);
    return {
      title: name,
      address,
      placeId,
      latitude,
      longitude,
      category,
      ...(website ? { website } : {}),
      ...(openingHours ? { openingHours } : {}),
      mapsUrl: mapUrl,
      source: "Geoapify / OpenStreetMap" as const,
    };
  }).filter((item): item is GeoapifyPlace => Boolean(item));
  return [...new Map(normalized.map((item) => [`${item.placeId}:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`, item])).values()].slice(0, 40);
}

export function buildGeoapifyRouteUrl(input: {
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  apiKey: string;
}): string {
  const valid = (point: GeoCoordinates) => Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
  if (!valid(input.origin) || !valid(input.destination)) throw new Error("INVALID_GEOAPIFY_COORDINATES");
  if (!input.apiKey.trim()) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  const params = new URLSearchParams({
    waypoints: `${input.origin.latitude},${input.origin.longitude}|${input.destination.latitude},${input.destination.longitude}`,
    mode: "drive",
    units: "imperial",
    format: "json",
    apiKey: input.apiKey.trim(),
  });
  return `https://api.geoapify.com/v1/routing?${params.toString()}`;
}

export function formatGeoapifyDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("INVALID_GEOAPIFY_ROUTE_TIME");
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function parseGeoapifyRoute(payload: unknown): GeoapifyRoute | null {
  const root = record(payload);
  const first = Array.isArray(root.results) ? record(root.results[0]) : {};
  const distance = finite(first.distance);
  const seconds = finite(first.time);
  if (distance === null || seconds === null || distance < 0 || seconds < 0) return null;
  // Geoapify returns miles when units=imperial. If the response omits the
  // unit marker, the API default is metric and distance is interpreted as m.
  const unit = text(first.distance_units) || text(record(root.properties).units) || "m";
  const miles = /mi|mile/i.test(unit) ? distance : distance / 1609.344;
  const distanceMeters = /mi|mile/i.test(unit) ? distance * 1609.344 : distance;
  return {
    distance: `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`,
    duration: formatGeoapifyDuration(seconds),
    durationSeconds: Math.round(seconds),
    distanceMeters,
  };
}

/** Conservative credit estimate based on a straight-line distance inflated for road detours. */
export function estimateGeoapifyRouteCredits(origin: GeoCoordinates, destination: GeoCoordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(destination.latitude - origin.latitude);
  const dLon = radians(destination.longitude - origin.longitude);
  const lat1 = radians(origin.latitude);
  const lat2 = radians(destination.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const straightKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const roadKmEstimate = straightKm * 1.5;
  return 1 + Math.ceil(roadKmEstimate / 500);
}
