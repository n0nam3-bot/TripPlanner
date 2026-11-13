import type { TripSearchInput } from "./types";
import { validateTripSearchInput } from "./validation";

export type SavedTripItemKind = "outbound-flight" | "return-flight" | "flight-fare" | "stay" | "stay-check-in" | "stay-check-out" | "activity" | "restaurant";

export type SavedTripItem = {
  kind: SavedTripItemKind;
  title: string;
  subtitle: string;
  date?: string;
  time?: string;
  price?: number | null;
  currency?: string;
  priceLabel?: string;
  /** Absolute event ordering timestamp, calculated with the same airport/destination timezone rules as the live trip schedule. */
  sortTimestamp?: number;
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
const ITEM_KINDS = new Set<SavedTripItemKind>(["outbound-flight", "return-flight", "flight-fare", "stay", "stay-check-in", "stay-check-out", "activity", "restaurant"]);
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
      const time = cleanText(item.time, 24);
      if (date && !validIsoDate(date)) return null;
      if (time && !/^(?:\d{1,2}:\d{2}(?:\s?[AP]M)?(?:\s+[A-Z]{2,5})?|Morning|Lunch|Afternoon|Dinner|Evening)$/i.test(time)) return null;
      let sortTimestamp: number | undefined;
      if (item.sortTimestamp !== undefined) {
        if (typeof item.sortTimestamp !== "number" || !Number.isFinite(item.sortTimestamp) || item.sortTimestamp < 946684800000 || item.sortTimestamp > 4102444800000) return null;
        sortTimestamp = Math.round(item.sortTimestamp);
      }
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
        ...(sortTimestamp !== undefined ? { sortTimestamp } : {}),
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

const SAVED_SLOT_MINUTES: Record<string, number> = { Morning: 9 * 60, Lunch: 12 * 60, Afternoon: 15 * 60, Dinner: 19 * 60, Evening: 20 * 60 + 30 };
const SAVED_KIND_ORDER: Record<SavedTripItemKind, number> = {
  "outbound-flight": 0,
  "flight-fare": 1,
  "stay-check-in": 2,
  stay: 3,
  activity: 4,
  restaurant: 5,
  "stay-check-out": 6,
  "return-flight": 7,
};

function savedItemFallbackTimestamp(item: SavedTripItem): number {
  if (typeof item.sortTimestamp === "number" && Number.isFinite(item.sortTimestamp)) return item.sortTimestamp;
  if (!item.date || !validIsoDate(item.date)) return Number.MAX_SAFE_INTEGER;
  let minutes = SAVED_SLOT_MINUTES[item.time || ""];
  if (minutes === undefined && item.time) {
    const match = item.time.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
    if (match) {
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      if (minute > 59 || hour > 23 || (!match[3] && hour > 23)) return Number.MAX_SAFE_INTEGER;
      if (match[3]) hour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
      minutes = hour * 60 + minute;
    }
  }
  if (minutes === undefined) {
    if (item.kind === "stay-check-in" || item.kind === "stay") minutes = 15 * 60;
    else if (item.kind === "stay-check-out") minutes = 18 * 60;
    else if (item.kind === "restaurant") minutes = 19 * 60;
    else if (item.kind === "return-flight") minutes = 23 * 60 + 59;
    else minutes = 0;
  }
  const [year, month, day] = item.date.split("-").map(Number);
  return Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
}

/** Stable chronological ordering shared by the public saved-trip page and snapshot creation. */
export function sortSavedTripItemsChronologically(items: SavedTripItem[]): SavedTripItem[] {
  return items.map((item, index) => ({ item, index, timestamp: savedItemFallbackTimestamp(item) }))
    .sort((a, b) => a.timestamp - b.timestamp
      || (SAVED_KIND_ORDER[a.item.kind] ?? 99) - (SAVED_KIND_ORDER[b.item.kind] ?? 99)
      || a.index - b.index)
    .map(({ item }) => item);
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
