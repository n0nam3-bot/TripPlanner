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
  /** GeoJSON coordinates in [longitude, latitude] order for map rendering. */
  geometry: Array<[number, number]>;
  /** Turn-by-turn instruction text supplied by the routing provider. */
  directions: string[];
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
  limit?: number;
}): string {
  const { center } = input;
  if (!Number.isFinite(center.latitude) || center.latitude < -90 || center.latitude > 90 || !Number.isFinite(center.longitude) || center.longitude < -180 || center.longitude > 180) {
    throw new Error("INVALID_GEOAPIFY_COORDINATES");
  }
  if (!input.apiKey.trim()) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  const radiusMeters = Math.max(500, Math.min(100_000, Math.round(input.radiusMeters)));
  const limit = Math.max(1, Math.min(40, Math.floor(input.limit ?? 40)));
  // The GET Places API documents countrycode filters as not yet available.
  // Use the supported circle filter for a bounded local search and proximity
  // bias for ranking. Country/locality matching is still validated after
  // results are normalized, before they are shown to the traveler.
  const params = new URLSearchParams({
    categories: geoapifyCategories(input.kind).join(","),
    filter: `circle:${center.longitude},${center.latitude},${radiusMeters}`,
    bias: `proximity:${center.longitude},${center.latitude}`,
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
    format: "geojson",
    details: "instruction_details",
    apiKey: input.apiKey.trim(),
  });
  return `https://api.geoapify.com/v1/routing?${params.toString()}`;
}


export function buildGeoapifyStaticMapUrl(input: {
  geometry: Array<[number, number]>;
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  apiKey: string;
  width?: number;
  height?: number;
}): string {
  if (!input.apiKey.trim()) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  if (input.geometry.length < 2) throw new Error("INVALID_GEOAPIFY_ROUTE_GEOMETRY");
  const points = input.geometry;
  const maxPoints = 72;
  const sampled = points.length <= maxPoints
    ? points
    : Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * (points.length - 1) / (maxPoints - 1))]);
  const longitudes = sampled.map(([longitude]) => longitude);
  const latitudes = sampled.map(([, latitude]) => latitude);
  const minLon = Math.min(...longitudes); const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
  const padLon = Math.max(0.004, (maxLon - minLon) * 0.14);
  const padLat = Math.max(0.004, (maxLat - minLat) * 0.14);
  const polyline = sampled.map(([longitude, latitude]) => `${longitude.toFixed(5)},${latitude.toFixed(5)}`).join(",");
  const width = Math.max(320, Math.min(1200, Math.round(input.width ?? 700)));
  const height = Math.max(220, Math.min(900, Math.round(input.height ?? 380)));
  const params = new URLSearchParams({
    style: "osm-carto",
    width: String(width),
    height: String(height),
    format: "png",
    attribution: "default",
    area: `rect:${(minLon - padLon).toFixed(5)},${(maxLat + padLat).toFixed(5)},${(maxLon + padLon).toFixed(5)},${(minLat - padLat).toFixed(5)}`,
    geometry: `polyline:${polyline};linecolor:#1b7655;linewidth:5;lineopacity:0.92`,
    marker: [
      `lonlat:${input.origin.longitude},${input.origin.latitude};type:circle;color:#1b7655;size:large;text:A;contentsize:12;shadow:no`,
      `lonlat:${input.destination.longitude},${input.destination.latitude};type:circle;color:#bc5a3a;size:large;text:B;contentsize:12;shadow:no`,
    ].join("|"),
    apiKey: input.apiKey,
  });
  return `https://maps.geoapify.com/v1/staticmap?${params.toString()}`;
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
  const feature = Array.isArray(root.features) ? record(root.features[0]) : {};
  const featureProperties = record(feature.properties);
  const featureGeometry = record(feature.geometry);
  const jsonRoute = Array.isArray(root.results) ? record(root.results[0]) : {};
  const route = Object.keys(featureProperties).length ? featureProperties : jsonRoute;
  const distance = finite(route.distance);
  const seconds = finite(route.time);
  if (distance === null || seconds === null || distance < 0 || seconds < 0) return null;
  // GeoJSON places the requested units in the top-level FeatureCollection
  // properties; the legacy JSON shape places distance_units on the route.
  // "imperial" means the distance value is already in miles.
  const requestedUnits = text(record(root.properties).units).toLowerCase();
  const unit = text(route.distance_units) || (/^imperial$/.test(requestedUnits) ? "mi" : /^metric$/.test(requestedUnits) ? "m" : "m");
  const isMiles = /mi|mile/i.test(unit);
  const miles = isMiles ? distance : distance / 1609.344;
  const distanceMeters = isMiles ? distance * 1609.344 : distance;

  const rawCoordinates: unknown[] = [];
  const geometryCoordinates = featureGeometry.coordinates;
  if (Array.isArray(geometryCoordinates)) {
    const geometryType = text(featureGeometry.type);
    const lines = geometryType === "LineString"
      ? [geometryCoordinates]
      : geometryCoordinates;
    for (const line of lines) {
      if (!Array.isArray(line)) continue;
      for (const point of line) rawCoordinates.push(point);
    }
  }
  // Backward compatibility for JSON route responses shaped as [{lat, lon}] or [[lon, lat]].
  if (!rawCoordinates.length && Array.isArray(jsonRoute.geometry)) {
    rawCoordinates.push(...jsonRoute.geometry);
  }
  const geometry: Array<[number, number]> = rawCoordinates.map((point) => {
    if (Array.isArray(point) && point.length >= 2) {
      const lon = finite(point[0]); const lat = finite(point[1]);
      return lon !== null && lat !== null && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : null;
    }
    const item = record(point);
    const lon = finite(item.lon ?? item.longitude); const lat = finite(item.lat ?? item.latitude);
    return lon !== null && lat !== null && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : null;
  }).filter((point): point is [number, number] => Boolean(point));

  const legs = Array.isArray(route.legs) ? route.legs : [];
  const directions = legs.flatMap((leg) => {
    const steps = record(leg).steps;
    return Array.isArray(steps) ? steps.map((step) => {
      const instruction = record(record(step).instruction);
      return text(instruction.text) || text(record(step).text);
    }).filter(Boolean) : [];
  }).slice(0, 12);

  return {
    distance: `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`,
    duration: formatGeoapifyDuration(seconds),
    durationSeconds: Math.round(seconds),
    distanceMeters,
    geometry,
    directions,
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
