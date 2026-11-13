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
  /** Road geometry as [longitude, latitude] pairs. */
  geometry: Array<[number, number]>;
  /** Non-empty, human-readable route instructions. */
  directions: string[];
  /** Precision-6 encoded polyline returned by Geoapify when requested. */
  polyline6?: string;
};

export type GeoapifyStaticMapRequest = {
  url: string;
  body: {
    style: string;
    width: number;
    height: number;
    scaleFactor: number;
    format: string;
    geometries: Array<Record<string, unknown>>;
    markers: Array<Record<string, unknown>>;
  };
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
    format: "json",
    details: "instruction_details,polyline6",
    lang: "en",
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

function normalizeRouteGeometry(value: unknown): Array<[number, number]> {
  const output: Array<[number, number]> = [];
  const addPair = (candidate: unknown) => {
    if (!Array.isArray(candidate) || candidate.length < 2) return false;
    const lon = finite(candidate[0]);
    const lat = finite(candidate[1]);
    if (lon === null || lat === null || lon < -180 || lon > 180 || lat < -90 || lat > 90) return false;
    output.push([lon, lat]);
    return true;
  };
  const visit = (candidate: unknown, depth = 0) => {
    if (depth > 5 || !Array.isArray(candidate)) return;
    if (addPair(candidate)) return;
    for (const child of candidate) visit(child, depth + 1);
  };
  const geometry = record(value);
  if (Array.isArray(geometry.coordinates)) visit(geometry.coordinates);
  else visit(value);
  return output.filter((point, index) => index === 0 || point[0] !== output[index - 1][0] || point[1] !== output[index - 1][1]);
}

function extractRouteDirections(route: UnknownRecord): string[] {
  const legs = Array.isArray(route.legs) ? route.legs : [];
  const instructions: string[] = [];
  for (const legValue of legs) {
    const leg = record(legValue);
    const steps = Array.isArray(leg.steps) ? leg.steps : [];
    for (const stepValue of steps) {
      const step = record(stepValue);
      const instruction = record(step.instruction);
      const candidates = [
        instruction.text,
        step.instruction,
        step.instruction_text,
        step.transition_instruction,
        step.text,
      ];
      const line = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
      if (typeof line === "string") instructions.push(line.trim());
    }
  }
  const topLevel = Array.isArray(route.steps) ? route.steps : [];
  if (!instructions.length) {
    for (const stepValue of topLevel) {
      const step = record(stepValue);
      const instruction = record(step.instruction);
      const line = [instruction.text, step.instruction, step.instruction_text, step.text]
        .find((candidate) => typeof candidate === "string" && candidate.trim());
      if (typeof line === "string") instructions.push(line.trim());
    }
  }
  return [...new Set(instructions.filter(Boolean))].slice(0, 16);
}

export function parseGeoapifyRoute(payload: unknown): GeoapifyRoute | null {
  const root = record(payload);
  const feature = Array.isArray(root.features) ? record(root.features[0]) : {};
  const featureProperties = record(feature.properties);
  const result = Array.isArray(root.results) ? record(root.results[0]) : {};
  const route = Object.keys(featureProperties).length ? featureProperties : result;
  const distance = finite(route.distance);
  const seconds = finite(route.time);
  if (distance === null || seconds === null || distance < 0 || seconds < 0) return null;
  const unit = text(route.distance_units) || text(record(root.properties).units) || "m";
  const isMiles = /mi|mile|imperial/i.test(unit);
  const miles = isMiles ? distance : distance / 1609.344;
  const distanceMeters = isMiles ? distance * 1609.344 : distance;
  const geometry = normalizeRouteGeometry(feature.geometry ?? route.geometry);
  const polyline6 = text(route.polyline6) || undefined;
  return {
    distance: `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`,
    duration: formatGeoapifyDuration(seconds),
    durationSeconds: Math.round(seconds),
    distanceMeters,
    geometry,
    directions: extractRouteDirections(route),
    ...(polyline6 ? { polyline6 } : {}),
  };
}

/** Build a server-side Static Maps POST request; the API key is never exposed to the browser. */
export function buildGeoapifyStaticMapRequest(input: {
  geometry: Array<[number, number]>;
  polyline6?: string;
  origin: GeoCoordinates;
  destination: GeoCoordinates;
  apiKey: string;
}): GeoapifyStaticMapRequest {
  const valid = (point: GeoCoordinates) => Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
  if (!valid(input.origin) || !valid(input.destination)) throw new Error("INVALID_GEOAPIFY_COORDINATES");
  if (!input.apiKey.trim()) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  const geometry = input.geometry.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90);
  const line = input.polyline6?.trim();
  if (!line && geometry.length < 2) throw new Error("GEOAPIFY_ROUTE_GEOMETRY_MISSING");
  return {
    url: `https://maps.geoapify.com/v1/staticmap?apiKey=${encodeURIComponent(input.apiKey.trim())}&attribution=default`,
    body: {
      style: "osm-bright",
      width: 800,
      height: 450,
      scaleFactor: 1,
      format: "jpeg",
      geometries: [line
        ? { type: "polyline6", value: line, linecolor: "#2563eb", lineopacity: 0.95, linewidth: 6, linestyle: "solid" }
        : { type: "polyline", value: geometry.map(([lon, lat]) => ({ lat, lon })), linecolor: "#2563eb", lineopacity: 0.95, linewidth: 6, linestyle: "solid" }],
      markers: [
        { lat: input.origin.latitude, lon: input.origin.longitude, type: "circle", color: "#15803d", size: 42, contentsize: 24, text: "A" },
        { lat: input.destination.latitude, lon: input.destination.longitude, type: "circle", color: "#dc2626", size: 42, contentsize: 24, text: "B" },
      ],
    },
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
