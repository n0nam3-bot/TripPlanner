import type { TripSearchInput } from "./types";
import { validateTripSearchInput } from "./validation";

export type SavedTripItemKind = "outbound-flight" | "return-flight" | "flight-fare" | "stay" | "stay-check-in" | "stay-check-out" | "activity" | "restaurant";

export type SavedTripSelectionReference =
  | { type: "flight"; direction: "outbound" | "return"; from: string; to: string; departure: string; arrival: string; segmentKeys: string[]; legacyDisplay?: boolean }
  | { type: "stay"; name: string; address: string }
  | { type: "experience"; kind: "activity" | "restaurant"; name: string; address: string; category: string; date: string; slot: "Morning" | "Lunch" | "Afternoon" | "Dinner" | "Evening"; time?: string }
  | { type: "flight-seller"; seller: string; fareType: string; price: number | null; currency: string };

export type SavedTripItem = {
  kind: SavedTripItemKind;
  title: string;
  subtitle: string;
  date?: string;
  time?: string;
  price?: number | null;
  currency?: string;
  priceLabel?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  websiteUrl?: string;
  websiteLabel?: string;
  mapsUrl?: string;
  sourceLabel?: string;
  /** Absolute event ordering timestamp, calculated with the same airport/destination timezone rules as the live trip schedule. */
  sortTimestamp?: number;
  /** Safe, non-token identifiers used to reselect matching live results when a traveler forks this itinerary. */
  selectionRef?: SavedTripSelectionReference;
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

/**
 * Fork a public snapshot into a separate editable draft. Preserve the selected
 * itinerary and its schedule; provider booking tokens are never stored in the
 * snapshot, and live selections are re-matched against refreshed results.
 */
export function buildSavedTripForkDraft(source: SavedTripDraft): SavedTripDraft {
  const copyPrefix = "Copy of ";
  const title = `${copyPrefix}${source.snapshot.title}`.slice(0, 140);
  return {
    search: source.search,
    snapshot: {
      version: 1,
      title,
      destinations: source.snapshot.destinations.map((destination) => ({
        label: destination.label,
        items: destination.items.map((item) => ({ ...item, details: [...item.details] })),
      })),
    },
  };
}

export const SAVED_TRIP_MAX_BYTES = 120 * 1024;
const ITEM_KINDS = new Set<SavedTripItemKind>(["outbound-flight", "return-flight", "flight-fare", "stay", "stay-check-in", "stay-check-out", "activity", "restaurant"]);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function cleanText(value: unknown, maxLength: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}


function safeSavedHttpsUrl(value: unknown, maxLength = 2048): string | undefined {
  const candidate = cleanText(value, maxLength);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return undefined;
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) return undefined;
    return url.toString().slice(0, maxLength);
  } catch {
    return undefined;
  }
}

function safeSavedImageUrl(value: unknown): string | undefined {
  const safe = safeSavedHttpsUrl(value, 2048);
  if (!safe) return undefined;
  try {
    const hostname = new URL(safe).hostname.toLowerCase();
    const allowed = [
      "googleusercontent.com", "gstatic.com", "serpapi.com", "geoapify.com",
      "booking.com", "bstatic.com", "trvl-media.com", "expedia.com",
      "expedia.net", "unsplash.com", "images.unsplash.com",
    ];
    return allowed.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ? safe : undefined;
  } catch {
    return undefined;
  }
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

function normalizeSelectionReference(value: unknown, itemKind: SavedTripItemKind): SavedTripSelectionReference | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const ref = value as Record<string, unknown>;
  if (ref.type === "flight" && (itemKind === "outbound-flight" || itemKind === "return-flight")) {
    const direction = ref.direction === "outbound" ? "outbound" : ref.direction === "return" ? "return" : null;
    const from = cleanText(ref.from, 100); const to = cleanText(ref.to, 100);
    const departure = cleanText(ref.departure, 100); const arrival = cleanText(ref.arrival, 100);
    const segmentKeys = Array.isArray(ref.segmentKeys) ? ref.segmentKeys.slice(0, 8).map((entry) => cleanText(entry, 420)).filter(Boolean) : [];
    if (!direction || !from || !to || !departure || !arrival || !segmentKeys.length) return undefined;
    if ((itemKind === "outbound-flight") !== (direction === "outbound")) return undefined;
    return { type: "flight", direction, from, to, departure, arrival, segmentKeys, ...(ref.legacyDisplay === true ? { legacyDisplay: true } : {}) };
  }
  if (ref.type === "stay" && (itemKind === "stay" || itemKind === "stay-check-in")) {
    const name = cleanText(ref.name, 180); const address = cleanText(ref.address, 280);
    return name ? { type: "stay", name, address } : undefined;
  }
  if (ref.type === "experience" && (itemKind === "activity" || itemKind === "restaurant")) {
    const kind = ref.kind === "activity" || ref.kind === "restaurant" ? ref.kind : null;
    const name = cleanText(ref.name, 180); const address = cleanText(ref.address, 280); const category = cleanText(ref.category, 140);
    const date = cleanText(ref.date, 10); const slot = ["Morning", "Lunch", "Afternoon", "Dinner", "Evening"].includes(String(ref.slot)) ? ref.slot as "Morning" | "Lunch" | "Afternoon" | "Dinner" | "Evening" : null;
    const time = cleanText(ref.time, 24);
    if (!kind || kind !== itemKind || !name || !date || !validIsoDate(date) || !slot) return undefined;
    if (time && !/^(?:\d{1,2}:\d{2}(?:\s?[AP]M)?(?:\s+[A-Z]{2,5})?)$/i.test(time)) return undefined;
    return { type: "experience", kind, name, address, category, date, slot, ...(time ? { time } : {}) };
  }
  if (ref.type === "flight-seller" && itemKind === "flight-fare") {
    const seller = cleanText(ref.seller, 120); const fareType = cleanText(ref.fareType, 120);
    const currency = cleanText(ref.currency, 3).toUpperCase();
    const price = ref.price === null ? null : typeof ref.price === "number" && Number.isFinite(ref.price) && ref.price >= 0 && ref.price <= 10000000 ? Math.round(ref.price * 100) / 100 : undefined;
    if (!seller || !fareType || !/^[A-Z]{3}$/.test(currency) || price === undefined) return undefined;
    return { type: "flight-seller", seller, fareType, price, currency };
  }
  return undefined;
}

function deriveLegacySelectionReference(item: Record<string, unknown>, itemKind: SavedTripItemKind): SavedTripSelectionReference | undefined {
  const title = cleanText(item.title, 180);
  const date = cleanText(item.date, 10);
  const time = cleanText(item.time, 24);
  const details = Array.isArray(item.details) ? item.details.map((value) => cleanText(value, 300)).filter(Boolean) : [];
  if ((itemKind === "stay-check-in" || itemKind === "stay") && title) {
    return { type: "stay", name: title, address: "" };
  }
  if ((itemKind === "activity" || itemKind === "restaurant") && title && validIsoDate(date)) {
    const explicitSlot = ["Morning", "Lunch", "Afternoon", "Dinner", "Evening"].includes(time) ? time as "Morning" | "Lunch" | "Afternoon" | "Dinner" | "Evening" : null;
    let slot = explicitSlot;
    if (!slot) {
      const match = /^(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i.exec(time);
      let hour = match ? Number(match[1]) : 9;
      if (match?.[3]) hour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
      slot = hour < 11 ? "Morning" : hour < 14 ? "Lunch" : hour < 17 ? "Afternoon" : hour < 20 ? "Dinner" : "Evening";
    }
    const customTime = time && !explicitSlot ? time : undefined;
    return { type: "experience", kind: itemKind, name: title, address: "", category: details[0] || "", date, slot, ...(customTime ? { time: customTime } : {}) };
  }
  if ((itemKind === "outbound-flight" || itemKind === "return-flight") && title) {
    const departureLine = details.find((detail) => detail.startsWith("Departs ")) || "";
    const arrivalLine = details.find((detail) => detail.startsWith("Arrives ")) || "";
    const from = departureLine.replace(/^Departs\s+/, "").split(" · ")[0]?.trim() || "";
    const to = arrivalLine.replace(/^Arrives\s+/, "").split(" · ")[0]?.trim() || "";
    const departure = departureLine.split(" · ").slice(1).join(" · ").trim();
    const arrival = arrivalLine.split(" · ").slice(1).join(" · ").trim();
    const segmentKeys = details.filter((detail) => /^Leg \d+:/i.test(detail));
    if (from && to && departure && arrival && segmentKeys.length) {
      return { type: "flight", direction: itemKind === "outbound-flight" ? "outbound" : "return", from, to, departure, arrival, segmentKeys, legacyDisplay: true };
    }
  }
  if (itemKind === "flight-fare" && cleanText(item.title, 180) === "Selected seller fare") {
    const seller = cleanText(item.subtitle, 120);
    const fareType = details[0] || "";
    const currency = cleanText(item.currency, 3).toUpperCase();
    const price = item.price === null ? null : typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0 ? item.price : undefined;
    if (seller && fareType && /^[A-Z]{3}$/.test(currency) && price !== undefined) return { type: "flight-seller", seller, fareType, price, currency };
  }
  return undefined;
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
      const rating = typeof item.rating === "number" && Number.isFinite(item.rating) && item.rating >= 0 && item.rating <= 5
        ? Math.round(item.rating * 10) / 10 : undefined;
      const reviewCount = typeof item.reviewCount === "number" && Number.isInteger(item.reviewCount) && item.reviewCount >= 0 && item.reviewCount <= 100000000
        ? item.reviewCount : undefined;
      const imageUrl = safeSavedImageUrl(item.imageUrl);
      const websiteUrl = safeSavedHttpsUrl(item.websiteUrl);
      const websiteLabel = cleanText(item.websiteLabel, 80);
      const mapsUrl = safeSavedHttpsUrl(item.mapsUrl);
      const sourceLabel = cleanText(item.sourceLabel, 80);
      const details = Array.isArray(item.details)
        ? item.details.slice(0, 10).map((entry) => cleanText(entry, 300)).filter(Boolean)
        : [];
      const selectionRef = normalizeSelectionReference(item.selectionRef, item.kind as SavedTripItemKind)
        ?? deriveLegacySelectionReference(item, item.kind as SavedTripItemKind);
      items.push({
        kind: item.kind as SavedTripItemKind,
        title: itemTitle,
        subtitle,
        ...(date ? { date } : {}),
        ...(time ? { time } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(currency ? { currency } : {}),
        ...(cleanText(item.priceLabel, 180) ? { priceLabel: cleanText(item.priceLabel, 180) } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(rating !== undefined ? { rating } : {}),
        ...(reviewCount !== undefined ? { reviewCount } : {}),
        ...(websiteUrl ? { websiteUrl } : {}),
        ...(websiteLabel ? { websiteLabel } : {}),
        ...(mapsUrl ? { mapsUrl } : {}),
        ...(sourceLabel ? { sourceLabel } : {}),
        ...(sortTimestamp !== undefined ? { sortTimestamp } : {}),
        ...(selectionRef ? { selectionRef } : {}),
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
