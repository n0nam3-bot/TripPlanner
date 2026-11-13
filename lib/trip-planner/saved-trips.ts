import type { TripSearchInput } from "./types";
import { validateTripSearchInput } from "./validation";

export type SavedTripItemKind = "outbound-flight" | "return-flight" | "flight-fare" | "stay" | "activity" | "restaurant";

export type SavedTripItem = {
  kind: SavedTripItemKind;
  title: string;
  subtitle: string;
  date?: string;
  time?: string;
  price?: number | null;
  currency?: string;
  priceLabel?: string;
  details: string[];
};

export type SavedTripDestination = {
  label: string;
  items: SavedTripItem[];
};

export type SavedTripSnapshot = {
  version: 1;
  title: string;
  destinations: SavedTripDestination[];
};

export type SavedTripDraft = {
  search: TripSearchInput;
  snapshot: SavedTripSnapshot;
};

export const SAVED_TRIP_MAX_BYTES = 120 * 1024;
const ITEM_KINDS = new Set<SavedTripItemKind>(["outbound-flight", "return-flight", "flight-fare", "stay", "activity", "restaurant"]);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function cleanText(value: unknown, maxLength: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function serializeTripSearchInput(input: TripSearchInput): string {
  const params = new URLSearchParams({
    origin: input.origin,
    originAirportCode: input.originAirportCode,
    destination: input.destination,
    destinationArea: input.destinationArea,
    destinationAirportCode: input.destinationAirportCode,
    depart: input.departureDate,
    return: input.returnDate,
    adults: String(input.adults),
    childrenAges: input.childrenAges.join(","),
    rooms: String(input.rooms),
    budget: String(input.budget),
    budgetMode: input.budgetMode,
    currency: input.currency,
    style: input.style,
    flexibleDays: String(input.flexibleDays),
    cabin: input.cabinClass,
    stops: input.stops,
    preferLayovers: input.preferredLayoverCountries.join(","),
    avoidLayovers: input.avoidLayoverCountries.join(","),
    hotelRating: String(input.minimumHotelRating),
    freeCancellation: String(input.freeCancellation),
    components: input.components.join(","),
    stayTypes: input.stayTypes.join(","),
    staySpaceType: input.staySpaceType,
    stayMust: input.stayMustHaveAmenities.join(","),
    stayPrefer: input.stayPreferredAmenities.join(","),
    temperatureMin: input.temperatureMin === null ? "" : String(input.temperatureMin),
    temperatureMax: input.temperatureMax === null ? "" : String(input.temperatureMax),
    temperatureUnit: input.temperatureUnit,
    planningNotes: input.planningNotes.join(" | "),
  });
  return params.toString();
}

export function normalizeSavedTripSnapshot(value: unknown): SavedTripSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.destinations) || record.destinations.length < 1 || record.destinations.length > 8) return null;
  const title = cleanText(record.title, 140);
  if (!title) return null;

  const destinations: SavedTripDestination[] = [];
  let totalItems = 0;
  for (const rawDestination of record.destinations) {
    if (!rawDestination || typeof rawDestination !== "object" || Array.isArray(rawDestination)) return null;
    const destination = rawDestination as Record<string, unknown>;
    const label = cleanText(destination.label, 160);
    if (!label || !Array.isArray(destination.items) || destination.items.length > 50) return null;
    const items: SavedTripItem[] = [];
    for (const rawItem of destination.items) {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return null;
      const item = rawItem as Record<string, unknown>;
      if (typeof item.kind !== "string" || !ITEM_KINDS.has(item.kind as SavedTripItemKind)) return null;
      const itemTitle = cleanText(item.title, 180);
      const subtitle = cleanText(item.subtitle, 280);
      if (!itemTitle) return null;
      const date = cleanText(item.date, 10);
      const time = cleanText(item.time, 20);
      if (date && !validIsoDate(date)) return null;
      if (time && !/^(?:\d{1,2}:\d{2}(?:\s?[AP]M)?|Morning|Lunch|Afternoon|Dinner|Evening)$/i.test(time)) return null;
      let price: number | null | undefined;
      if (item.price === null) price = null;
      else if (item.price !== undefined) {
        if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 || item.price > 10000000) return null;
        price = Math.round(item.price * 100) / 100;
      }
      const currency = cleanText(item.currency, 3).toUpperCase();
      if (currency && !/^[A-Z]{3}$/.test(currency)) return null;
      const details = Array.isArray(item.details)
        ? item.details.slice(0, 10).map((entry) => cleanText(entry, 300)).filter(Boolean)
        : [];
      items.push({
        kind: item.kind as SavedTripItemKind,
        title: itemTitle,
        subtitle,
        ...(date ? { date } : {}),
        ...(time ? { time } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(currency ? { currency } : {}),
        ...(cleanText(item.priceLabel, 120) ? { priceLabel: cleanText(item.priceLabel, 120) } : {}),
        details,
      });
      totalItems += 1;
      if (totalItems > 50) return null;
    }
    destinations.push({ label, items });
  }

  const snapshot: SavedTripSnapshot = { version: 1, title, destinations };
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > SAVED_TRIP_MAX_BYTES) return null;
  return snapshot;
}

export function validateSavedTripDraft(value: unknown): { draft?: SavedTripDraft; errors: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: ["Saved trip payload must be an object."] };
  const record = value as Record<string, unknown>;
  const validatedSearch = validateTripSearchInput(record.search);
  if (!validatedSearch.input) return { errors: validatedSearch.errors.length ? validatedSearch.errors : ["Trip search details are invalid."] };
  const snapshot = normalizeSavedTripSnapshot(record.snapshot);
  if (!snapshot) return { errors: ["Saved trip details are invalid or too large."] };
  const draft: SavedTripDraft = { search: validatedSearch.input, snapshot };
  const bytes = new TextEncoder().encode(JSON.stringify(draft)).length;
  if (bytes > SAVED_TRIP_MAX_BYTES) return { errors: ["Saved trip is too large to store. Remove some selected items and try again."] };
  return { draft, errors: [] };
}
