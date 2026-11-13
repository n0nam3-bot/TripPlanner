import { LAYOVER_COUNTRY_OPTIONS } from "../trip-planner/flight-routing";
import { resolveAirportCode } from "../trip-planner/airports";
import { airportCountry } from "../trip-planner/flight-routing";
import type {
  CabinClass,
  StayAmenity,
  StaySpaceType,
  StayType,
  StopPreference,
  TripComponent,
  TripStyle,
} from "../trip-planner/types";

export type SearchPreferenceDraft = {
  origin?: string;
  originAirportCode?: string;
  destination?: string;
  destinationAirportCode?: string;
  destinationArea?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  childrenAges?: number[];
  rooms?: number;
  budget?: number;
  budgetMode?: "total" | "per_person";
  currency?: "USD" | "CAD" | "EUR" | "GBP";
  components?: TripComponent[];
  restaurantsRequested?: boolean;
  tripStyle?: TripStyle;
  stayTypes?: StayType[];
  staySpaceType?: StaySpaceType;
  mustHaveAmenities?: StayAmenity[];
  preferredAmenities?: StayAmenity[];
  cabinClass?: CabinClass;
  stops?: StopPreference;
  preferredLayoverCountries?: string[];
  avoidLayoverCountries?: string[];
  minimumHotelRating?: 0 | 3 | 4 | 5;
  freeCancellation?: boolean;
  temperatureMin?: number;
  temperatureMax?: number;
  temperatureUnit?: "F" | "C";
  notes?: string[];
};

const tripStyles = new Set<TripStyle>(["any", "beach", "city", "food", "nature", "romantic", "family", "adventure", "culture"]);
const tripComponents = new Set<TripComponent>(["flights", "stays", "activities"]);
const stayTypes = new Set<StayType>(["hotels", "vacation_rentals"]);
const spaceTypes = new Set<StaySpaceType>(["any", "entire_place", "private_room", "shared_room"]);
const amenities = new Set<StayAmenity>([
  "private_pool", "shared_pool", "pool", "indoor_pool", "heated_pool", "outdoor_pool", "hot_tub", "sauna", "outdoor_grill",
  "kitchen", "kitchenette", "fireplace", "washer_dryer", "balcony_terrace", "free_parking", "pet_friendly", "beach_access", "gym", "wifi", "air_conditioning",
]);
const cabins = new Set<CabinClass>(["economy", "premium_economy", "business", "first"]);
const stops = new Set<StopPreference>(["any", "nonstop", "one_stop", "two_stops"]);
const currencies = new Set(["USD", "CAD", "EUR", "GBP"]);
const layoverCountries = [...LAYOVER_COUNTRY_OPTIONS];
const layoverCountryByNormalized = new Map(layoverCountries.map((country) => [country.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), country]));
const COUNTRY_ALIASES: Record<string, string> = { usa: "United States", us: "United States", america: "United States", uk: "United Kingdom", uae: "United Arab Emirates", korea: "South Korea" };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanText(value: unknown, max = 100): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return cleaned && !/^(null|none|n\/a|unknown)$/i.test(cleaned) ? cleaned : undefined;
}

function boundedNumber(value: unknown, min: number, max: number, integer = false): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return undefined;
  return integer ? Math.floor(value) : value;
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  return typeof value === "string" && allowed.has(value as T) ? value as T : undefined;
}

function enumList<T extends string>(value: unknown, allowed: Set<T>, max = 10): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = [...new Set(value.filter((item): item is T => typeof item === "string" && allowed.has(item as T)))].slice(0, max);
  return result.length ? result : undefined;
}

function sanitizeCountryList(value: unknown, max = 12): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const resolved = value.map((item) => {
    if (typeof item !== "string") return undefined;
    const normalized = item.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return COUNTRY_ALIASES[normalized] ?? layoverCountryByNormalized.get(normalized);
  }).filter((item): item is string => Boolean(item));
  const unique = [...new Set(resolved)].slice(0, max);
  return unique.length ? unique : undefined;
}

function validDate(value: unknown, todayLocal: string): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < todayLocal) return undefined;
  return value;
}

/** Extract a JSON object from a model response without accepting arbitrary prose as a draft. */
export function extractSearchPreferenceJson(answer: string): Record<string, unknown> | null {
  const trimmed = answer.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return record(JSON.parse(trimmed.slice(start, end + 1)));
  } catch {
    return null;
  }
}

/** Whitelist all model output before it is allowed to update the search form. */
export function sanitizeSearchPreferenceDraft(value: unknown, todayLocal: string, sourceText = ""): SearchPreferenceDraft {
  const raw = record(value);
  const draft: SearchPreferenceDraft = {};
  const source = sourceText.toLocaleLowerCase();

  const origin = cleanText(raw.origin, 90);
  const destination = cleanText(raw.destination, 120);
  const destinationArea = cleanText(raw.destinationArea, 100);
  const originAirportCode = cleanText(raw.originAirportCode, 3)?.toUpperCase();
  const destinationAirportCode = cleanText(raw.destinationAirportCode, 3)?.toUpperCase();
  const flightIntent = /\b(flights?|fly|flying|airfare|air travel|plane tickets?)\b/i.test(sourceText);
  if (origin) draft.origin = origin;
  // Validate airport-looking tokens against the real directory. Ordinary
  // words such as "the" must never become an invented IATA code.
  if (flightIntent && originAirportCode && /^[A-Z]{3}$/.test(originAirportCode) && airportCountry(originAirportCode)) draft.originAirportCode = originAirportCode;
  if (destination) draft.destination = destination;
  if (destinationArea) draft.destinationArea = destinationArea;
  if (flightIntent && destinationAirportCode && /^[A-Z]{3}$/.test(destinationAirportCode) && airportCountry(destinationAirportCode)) draft.destinationAirportCode = destinationAirportCode;

  const departureDate = validDate(raw.departureDate, todayLocal);
  const returnDate = validDate(raw.returnDate, todayLocal);
  if (departureDate) draft.departureDate = departureDate;
  if (returnDate && (!departureDate || returnDate > departureDate)) draft.returnDate = returnDate;

  const adults = boundedNumber(raw.adults, 1, 9, true);
  const rooms = boundedNumber(raw.rooms, 1, 8, true);
  const budget = boundedNumber(raw.budget, 50, 1000000);
  if (adults !== undefined) draft.adults = adults;
  if (rooms !== undefined) draft.rooms = rooms;
  if (budget !== undefined) draft.budget = budget;
  if (Array.isArray(raw.childrenAges)) {
    const ages = raw.childrenAges.slice(0, 8).map((age) => boundedNumber(age, 1, 17, true));
    if (ages.length && ages.every((age): age is number => age !== undefined)) draft.childrenAges = ages;
  }

  const budgetMode = enumValue(raw.budgetMode, new Set(["total", "per_person"] as const));
  const currency = enumValue(raw.currency, currencies) as SearchPreferenceDraft["currency"];
  let components = enumList(raw.components, tripComponents, 3);
  const tripStyle = enumValue(raw.tripStyle, tripStyles);
  const restaurantsRequested = raw.restaurantsRequested === true || /\b(restaurants?|dining|places to eat|where to eat|food options)\b/i.test(sourceText);
  if (restaurantsRequested) draft.restaurantsRequested = true;
  const parsedStayTypes = enumList(raw.stayTypes, stayTypes, 2);
  let staySpaceType = enumValue(raw.staySpaceType, spaceTypes);
  const explicitEntirePhrase = /\b(entire|whole)\s+(?:house|home|property|place|cabin|condo|villa)\b|\b(?:rent|book|looking for)\s+(?:a|an)\s+(?:whole|entire)\s+(?:house|home|property|place|cabin|condo|villa)\b|\bprivate\s+(?:house|home|property|cabin|condo|villa)\b/i.test(source);
  const entirePlaceNegated = /\b(?:no|not|without|don't|do not|doesn't|does not)\b.{0,36}\b(?:entire|whole)\s+(?:house|home|property|place|cabin|condo|villa)\b/i.test(source);
  const explicitEntirePlace = explicitEntirePhrase && !entirePlaceNegated;
  const explicitPrivateRoom = /\bprivate\s+room\b/i.test(source) && !/\b(?:no|not|without|don't|do not|doesn't|does not)\b.{0,24}\bprivate\s+room\b/i.test(source);
  const explicitSharedRoom = /\bshared\s+room\b/i.test(source) && !/\b(?:no|not|without|don't|do not|doesn't|does not)\b.{0,24}\bshared\s+room\b/i.test(source);
  if (staySpaceType === "entire_place" && !explicitEntirePlace) staySpaceType = undefined;
  if (staySpaceType === "private_room" && !explicitPrivateRoom) staySpaceType = undefined;
  if (staySpaceType === "shared_room" && !explicitSharedRoom) staySpaceType = undefined;
  let mustHave = enumList(raw.mustHaveAmenities, amenities, 12) ?? [];
  let preferred = enumList(raw.preferredAmenities, amenities, 12) ?? [];
  const privatePoolNegated = /\b(?:no|not|without|don't|do not|doesn't|does not)\b.{0,36}\bprivate\s+pool\b/i.test(source);
  const sharedPoolNegated = /\b(?:no|not|without|don't|do not|doesn't|does not)\b.{0,36}\b(?:shared|community|communal)\s+pool\b/i.test(source);
  const explicitPrivatePool = !privatePoolNegated && (/\b(private|exclusive|not shared|only for (?:my|our|the) (?:group|guests))\b.{0,35}\bpool\b|\bpool\b.{0,35}\b(private|exclusive|not shared)\b/i.test(source));
  const explicitSharedPool = !sharedPoolNegated && (/\b(shared|community|communal)\b.{0,35}\bpool\b|\bpool\b.{0,35}\b(shared|community|communal)\b/i.test(source));
  if (!explicitPrivatePool) {
    if (privatePoolNegated) {
      mustHave = mustHave.filter((item) => item !== "private_pool");
      preferred = preferred.filter((item) => item !== "private_pool");
    } else {
      mustHave = mustHave.map((item) => item === "private_pool" ? (explicitSharedPool ? "shared_pool" : "pool") : item);
      preferred = preferred.map((item) => item === "private_pool" ? (explicitSharedPool ? "shared_pool" : "pool") : item);
    }
  }
  if (!explicitSharedPool) {
    mustHave = mustHave.filter((item) => item !== "shared_pool");
    preferred = preferred.filter((item) => item !== "shared_pool");
  }
  mustHave = [...new Set(mustHave)];
  preferred = [...new Set(preferred)].filter((item) => !mustHave.includes(item));
  const cabinClass = enumValue(raw.cabinClass, cabins);
  const stopPreference = enumValue(raw.stops, stops);
  const preferredLayoverCountries = sanitizeCountryList(raw.preferredLayoverCountries, 8);
  const avoidLayoverCountries = sanitizeCountryList(raw.avoidLayoverCountries, 12) ?? [];
  const minimumHotelRating = boundedNumber(raw.minimumHotelRating, 0, 5, true);
  const temperatureUnit = enumValue(raw.temperatureUnit, new Set(["F", "C"] as const));
  const temperatureMin = boundedNumber(raw.temperatureMin, -40, temperatureUnit === "C" ? 55 : 130);
  const temperatureMax = boundedNumber(raw.temperatureMax, -40, temperatureUnit === "C" ? 55 : 130);

  const hasStayIntent = Boolean(parsedStayTypes || staySpaceType && staySpaceType !== "any" || mustHave.length || preferred.length);
  if (hasStayIntent && (!components || !components.includes("stays"))) components = [...new Set<TripComponent>([...(components ?? []), "stays"])];
  if (budgetMode) draft.budgetMode = budgetMode;
  if (currency) draft.currency = currency;
  if (components) draft.components = components;
  if (tripStyle) draft.tripStyle = tripStyle;
  if (staySpaceType) draft.staySpaceType = staySpaceType;
  if (parsedStayTypes || staySpaceType && staySpaceType !== "any") draft.stayTypes = staySpaceType && staySpaceType !== "any" ? ["vacation_rentals"] : parsedStayTypes;
  if (mustHave.length) draft.mustHaveAmenities = mustHave;
  if (preferred.length) draft.preferredAmenities = preferred;
  if (cabinClass) draft.cabinClass = cabinClass;
  if (stopPreference) draft.stops = stopPreference;
  if (preferredLayoverCountries) draft.preferredLayoverCountries = preferredLayoverCountries.filter((country) => !avoidLayoverCountries.includes(country));
  if (avoidLayoverCountries.length) draft.avoidLayoverCountries = avoidLayoverCountries;
  if (minimumHotelRating !== undefined && [0, 3, 4, 5].includes(minimumHotelRating)) draft.minimumHotelRating = minimumHotelRating as 0 | 3 | 4 | 5;
  if (typeof raw.freeCancellation === "boolean") draft.freeCancellation = raw.freeCancellation;
  if (temperatureUnit) draft.temperatureUnit = temperatureUnit;
  if (temperatureMin !== undefined) draft.temperatureMin = temperatureMin;
  if (temperatureMax !== undefined && (temperatureMin === undefined || temperatureMax > temperatureMin)) draft.temperatureMax = temperatureMax;
  if (Array.isArray(raw.notes)) {
    const notes = raw.notes.map((item) => cleanText(item, 140)).filter((item): item is string => Boolean(item)).slice(0, 3);
    if (notes.length) draft.notes = notes;
  }
  return draft;
}


const KNOWN_DESTINATION_AREAS: Array<{ aliases: string[]; destination: string; destinationArea: string }> = [
  { aliases: ["las terrenas"], destination: "Dominican Republic", destinationArea: "Las Terrenas" },
  { aliases: ["samana", "samaná"], destination: "Dominican Republic", destinationArea: "Samaná" },
  { aliases: ["las galeras"], destination: "Dominican Republic", destinationArea: "Las Galeras" },
  { aliases: ["punta cana"], destination: "Dominican Republic", destinationArea: "Punta Cana" },
  { aliases: ["bavaro", "bávaro", "bavaro beach"], destination: "Dominican Republic", destinationArea: "Bávaro" },
  { aliases: ["cap cana"], destination: "Dominican Republic", destinationArea: "Cap Cana" },
  { aliases: ["santo domingo"], destination: "Dominican Republic", destinationArea: "Santo Domingo" },
  { aliases: ["santiago de los caballeros", "santiago"], destination: "Dominican Republic", destinationArea: "Santiago" },
  { aliases: ["puerto plata"], destination: "Dominican Republic", destinationArea: "Puerto Plata" },
  { aliases: ["la romana"], destination: "Dominican Republic", destinationArea: "La Romana" },
  { aliases: ["bayahibe"], destination: "Dominican Republic", destinationArea: "Bayahibe" },
  { aliases: ["sosua", "sosúa"], destination: "Dominican Republic", destinationArea: "Sosúa" },
  { aliases: ["cabarete"], destination: "Dominican Republic", destinationArea: "Cabarete" },
  { aliases: ["poconos", "pocono mountains"], destination: "Pennsylvania", destinationArea: "Poconos" },
  { aliases: ["lake harmony"], destination: "Pennsylvania", destinationArea: "Lake Harmony" },
  { aliases: ["jim thorpe"], destination: "Pennsylvania", destinationArea: "Jim Thorpe" },
  { aliases: ["stroudsburg", "east stroudsburg"], destination: "Pennsylvania", destinationArea: "Stroudsburg" },
  { aliases: ["seneca falls", "seneca falls ny", "seneca falls new york"], destination: "New York", destinationArea: "Seneca Falls" },
];

function normalizedPhrase(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsPhrase(source: string, phrase: string): boolean {
  return (` ${normalizedPhrase(source)} `).includes(` ${normalizedPhrase(phrase)} `);
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

type ParsedDateToken = { index: number; month: number; day: number; year?: number; raw: string };

function collectDateTokens(source: string): ParsedDateToken[] {
  const found: ParsedDateToken[] = [];
  const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g;
  for (const match of source.matchAll(iso)) {
    found.push({ index: match.index ?? 0, year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), raw: match[0] });
  }
  const monthNames = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
  const monthFirst = new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "gi");
  for (const match of source.matchAll(monthFirst)) {
    found.push({ index: match.index ?? 0, month: MONTHS[match[1].toLowerCase()], day: Number(match[2]), year: match[3] ? Number(match[3]) : undefined, raw: match[0] });
  }
  // In ranges such as "Dec 25th to the 27th", inherit the month and any
  // explicit year for the second day instead of silently dropping it.
  const monthRange = new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\s+(?:to|through|until|[-–])\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "gi");
  for (const match of source.matchAll(monthRange)) {
    const startIndex = match.index ?? 0;
    const month = MONTHS[match[1].toLowerCase()];
    const startYear = match[3] ? Number(match[3]) : undefined;
    found.push({ index: startIndex, month, day: Number(match[2]), year: startYear, raw: match[0] });
    found.push({ index: startIndex + match[0].lastIndexOf(match[4]), month, day: Number(match[4]), year: match[5] ? Number(match[5]) : startYear, raw: match[4] });
  }
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:,?\\s+(20\\d{2}))?\\b`, "gi");
  for (const match of source.matchAll(dayFirst)) {
    found.push({ index: match.index ?? 0, day: Number(match[1]), month: MONTHS[match[2].toLowerCase()], year: match[3] ? Number(match[3]) : undefined, raw: match[0] });
  }
  const numeric = /\b(\d{1,2})[/.](\d{1,2})(?:[/.](20\d{2}))?\b(?!\s*[kKmM]\b)/g;
  for (const match of source.matchAll(numeric)) {
    found.push({ index: match.index ?? 0, month: Number(match[1]), day: Number(match[2]), year: match[3] ? Number(match[3]) : undefined, raw: match[0] });
  }
  const unique = new Map<number, ParsedDateToken>();
  for (const token of found.sort((a, b) => a.index - b.index)) {
    if (token.month < 1 || token.month > 12 || token.day < 1 || token.day > 31) continue;
    if (!unique.has(token.index)) unique.set(token.index, token);
  }
  return [...unique.values()].sort((a, b) => a.index - b.index);
}

function formatISODate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function resolveDateToken(token: ParsedDateToken, todayLocal: string, notBefore = todayLocal): string | undefined {
  const floor = new Date(`${notBefore}T00:00:00Z`);
  const startYear = token.year ?? floor.getUTCFullYear();
  const endYear = token.year ?? startYear + 4;
  for (let year = startYear; year <= endYear; year += 1) {
    const value = formatISODate(year, token.month, token.day);
    if (!value) continue;
    if (token.year !== undefined && value < todayLocal) return undefined;
    if (value >= notBefore) return value;
  }
  return undefined;
}

function addCalendarDays(dateValue: string, days: number): string | undefined {
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseCompactBudget(source: string): { amount: number; currency: "USD" | "CAD" | "EUR" | "GBP"; mode: "total" | "per_person" } | undefined {
  const numberPattern = String.raw`(\d[\d,]*(?:\.\d+)?)(?:\s*(k|m|thousand|million))?`;
  const contextual = new RegExp(String.raw`\b(?:budget(?:\s+(?:of|is|it\s+is))?|under|below|up\s+to|max(?:imum)?)\b[^\d$€£]{0,28}(?:us\$|[$€£])?\s*${numberPattern}\b`, "i").exec(source);
  const currencyOnly = new RegExp(String.raw`(?:us\$|[$€£])\s*${numberPattern}\b`, "i").exec(source);
  const match = contextual || currencyOnly;
  if (!match) return undefined;
  const rawNumber = contextual ? match[1] : match[1];
  const suffix = (contextual ? match[2] : match[2])?.toLowerCase();
  const base = Number(rawNumber.replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return undefined;
  const multiplier = suffix === "k" || suffix === "thousand" ? 1000 : suffix === "m" || suffix === "million" ? 1000000 : 1;
  const amount = Math.round(base * multiplier * 100) / 100;
  if (amount < 50 || amount > 1000000) return undefined;
  const currency: "USD" | "CAD" | "EUR" | "GBP" = /\b(cad|canadian dollars?)\b/i.test(source) ? "CAD"
    : /\b(eur|euros?)\b|€/i.test(source) ? "EUR"
      : /\b(gbp|pounds?)\b|£/i.test(source) ? "GBP" : "USD";
  return { amount, currency, mode: /\bper person\b|\beach\b|\bper traveler\b|\bper traveller\b/i.test(source) ? "per_person" : "total" };
}

function extractLayoverCountryPreferences(source: string): { preferred: string[]; avoided: string[] } {
  const preferred: string[] = [];
  const avoided: string[] = [];
  for (const country of LAYOVER_COUNTRY_OPTIONS) {
    const escaped = country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(^|[^a-z])${escaped}(?=$|[^a-z])`, "i").exec(source);
    if (!match || match.index === undefined) continue;
    const before = source.slice(Math.max(0, match.index - 100), match.index);
    // Use the latest connection instruction before this country, rather than
    // letting an avoid/prefer statement about a different country leak over.
    const intentMatches = [...before.matchAll(/\b(avoid|avoiding|exclude|excluding|skip|never|prefer|preferred|ideally|favor|favour)\b/gi)];
    const latestIntent = intentMatches.length ? intentMatches[intentMatches.length - 1][1].toLowerCase() : "";
    const negativeTransit = /\b(?:do not|don't|dont|not to|no)\b[^.!?;]{0,45}\b(?:connect|stop|layover|transit)\b[^.!?;]{0,24}$/i.test(before);
    if (["avoid", "avoiding", "exclude", "excluding", "skip", "never"].includes(latestIntent) || negativeTransit) avoided.push(country);
    else if (["prefer", "preferred", "ideally", "favor", "favour"].includes(latestIntent)
      || /\b(connect through|connection through|layover in|stop in|stops in|transit through|connect via|route through)\b/i.test(before)) preferred.push(country);
  }
  return {
    preferred: [...new Set(preferred)].filter((country) => !avoided.includes(country)).slice(0, 8),
    avoided: [...new Set(avoided)].slice(0, 12),
  };
}

/** Deterministic parser used when an AI provider is unavailable or incomplete. */
export function parseDeterministicSearchPreferenceDraft(description: string, todayLocal: string): SearchPreferenceDraft {
  const source = description.trim();
  const raw: Record<string, unknown> = {};

  const wantsFlights = /\b(flights?|fly|flying|airfare|air travel|plane tickets?)\b/i.test(source);
  const drivingIntent = /\b(driving|drive|by car|road trip|car trip)\b/i.test(source);
  // Keep the destination phrase separate from an origin stated after it,
  // e.g. "driving to Seneca Falls, New York from NYC".
  const destinationClause = source.match(/\bto\s+(?:the\s+)?(.+?)(?=\s+\b(?:from|on|depart(?:ing)?|return(?:ing)?|back|budget|avoid|prefer|premium|eco|business|economy|with|for)\b|[,;]|$)/i)?.[1]?.trim();
  const knownAreas = [...KNOWN_DESTINATION_AREAS, { aliases: ["tirana", "tirane"], destination: "Albania", destinationArea: "Tirana" }]
    .sort((a, b) => Math.max(...b.aliases.map((item) => normalizedPhrase(item).length)) - Math.max(...a.aliases.map((item) => normalizedPhrase(item).length)));
  const area = knownAreas.find((item) => item.aliases.some((alias) => containsPhrase(source, alias)));
  if (area) {
    raw.destination = area.destination;
    raw.destinationArea = area.destinationArea;
  } else {
    const countries = [...new Set<string>([...LAYOVER_COUNTRY_OPTIONS, "Dominican Republic", "Puerto Rico", "United States", "United Kingdom", "Mexico", "Portugal", "Jamaica", "Aruba", "Canada", "France", "Italy", "Spain", "Japan", "New York"] )];
    const countryText = ` ${normalizedPhrase(destinationClause || source)} `;
    const fallbackText = ` ${normalizedPhrase(source)} `;
    const country = countries
      .map((item) => ({ country: item, index: countryText.indexOf(` ${normalizedPhrase(item)} `), fallbackIndex: fallbackText.indexOf(` ${normalizedPhrase(item)} `) }))
      .filter((item) => item.index >= 0 || item.fallbackIndex >= 0)
      .sort((a, b) => (a.index >= 0 ? a.index : Number.MAX_SAFE_INTEGER) - (b.index >= 0 ? b.index : Number.MAX_SAFE_INTEGER)
        || (a.fallbackIndex >= 0 ? a.fallbackIndex : Number.MAX_SAFE_INTEGER) - (b.fallbackIndex >= 0 ? b.fallbackIndex : Number.MAX_SAFE_INTEGER))[0]?.country;
    if (country) raw.destination = country;
  }

  const fromAnywhere = source.match(/\bfrom\s+(.+?)(?=\s+\b(?:to|on|depart(?:ing)?|return(?:ing)?|back|budget|with|for|and|then)\b|[,;.!?]|$)/i);
  if (fromAnywhere?.[1]) {
    const requestedOrigin = fromAnywhere[1].trim().replace(/[,.]+$/, "");
    const originCode = wantsFlights ? resolveAirportCode(requestedOrigin) : null;
    if (requestedOrigin) raw.origin = originCode && /^[a-z]{3}$/i.test(requestedOrigin) ? requestedOrigin.toUpperCase() : originCode ? `${requestedOrigin} (${originCode})` : requestedOrigin;
    if (originCode && airportCountry(originCode)) raw.originAirportCode = originCode;
    if (drivingIntent && !wantsFlights) raw.notes = [...(Array.isArray(raw.notes) ? raw.notes as string[] : []), `Driving trip: from ${requestedOrigin}; flights are not requested.`];
  }

  // Only parse airport gateways for an explicit flight request, and verify
  // each candidate against the supported airport/metro directory.
  if (wantsFlights) {
    const directDestinationCode = source.match(/\bto\s+(?:the\s+)?([a-z]{3})\b/i)?.[1]?.toUpperCase();
    const clauseAirportCode = [...(destinationClause || "").matchAll(/\b([a-z]{3})\b/gi)]
      .map((match) => match[1].toUpperCase()).find((code) => Boolean(airportCountry(code)));
    const trailingDestinationCode = destinationClause?.match(/\b([a-z]{3})\)?\s*$/i)?.[1]?.toUpperCase();
    const explicitDestinationCode = [directDestinationCode, clauseAirportCode, trailingDestinationCode].find((code) => Boolean(code && airportCountry(code)));
    if (explicitDestinationCode) raw.destinationAirportCode = explicitDestinationCode;
    if (!raw.destination && typeof raw.destinationAirportCode === "string") {
      const inferredCountry = airportCountry(raw.destinationAirportCode);
      if (inferredCountry) raw.destination = inferredCountry;
    }
    if (!raw.destinationAirportCode && typeof raw.destination === "string") {
      const destinationCode = resolveAirportCode(String(raw.destinationArea || raw.destination));
      if (destinationCode && airportCountry(destinationCode)) raw.destinationAirportCode = destinationCode;
    }
  }
  if (raw.destination === "Albania" && raw.destinationAirportCode === "TIA" && !raw.destinationArea) raw.destinationArea = "Tirana";

  const asksRental = /\b(airbnb|vrbo|vacation rental|vacation rentals|holiday rental|holiday rentals|rental home|rental property|renting a place|rent a house|rent a home|rent a cabin|rent a villa)\b/i.test(source);
  const asksHotel = /\b(hotel|hotels|motel|resort|inn|hostel)\b/i.test(source);
  if (asksRental || asksHotel) {
    raw.stayTypes = asksRental && asksHotel ? ["vacation_rentals", "hotels"] : asksRental ? ["vacation_rentals"] : ["hotels"];
    raw.components = ["stays"];
  }
  if (wantsFlights) raw.components = [...new Set([...(Array.isArray(raw.components) ? raw.components as string[] : []), "flights"])];
  const requestsActivitiesOrDining = /\b(activities|things to do|attractions|excursions|tours|restaurants?|dining|places to eat|where to eat)\b/i.test(source);
  if (requestsActivitiesOrDining) raw.components = [...new Set([...(Array.isArray(raw.components) ? raw.components as string[] : []), "activities"])];
  if (/\b(restaurants?|dining|places to eat|where to eat|food options)\b/i.test(source)) raw.restaurantsRequested = true;

  if (/\b(beachfront|on the beach|oceanfront|steps from the beach|direct beach access)\b/i.test(source)) {
    raw.tripStyle = "beach";
    raw.mustHaveAmenities = ["beach_access"];
  } else if (/\b(by|near|close to|nearby) the beach\b/i.test(source) || /\bbeach\b/i.test(source)) {
    raw.tripStyle = "beach";
    raw.preferredAmenities = ["beach_access"];
    raw.notes = ["Beach proximity was requested. Confirm the property's actual walking distance and whether beach access is direct."];
  }

  const privatePool = /\bprivate pool\b/i.test(source) && !/\b(no|not|without|don't|do not)\b.{0,30}\bprivate pool\b/i.test(source);
  const sharedPool = /\b(shared|community|communal) pool\b/i.test(source);
  const mustHave = Array.isArray(raw.mustHaveAmenities) ? raw.mustHaveAmenities as string[] : [];
  const preferred = Array.isArray(raw.preferredAmenities) ? raw.preferredAmenities as string[] : [];
  const addMust = (id: string) => { if (!mustHave.includes(id)) mustHave.push(id); };
  const poolNegated = /\b(no|not|without|don't|do not|doesn't|does not)\b.{0,36}\b(pool)\b/i.test(source);
  if (privatePool) addMust("private_pool");
  else if (sharedPool) addMust("shared_pool");
  else if (!poolNegated && /\bpool\b/i.test(source)) addMust("pool");
  if (/\bindoor pool\b/i.test(source)) addMust("indoor_pool");
  if (/\bheated pool\b/i.test(source)) addMust("heated_pool");
  if (/\boutdoor pool\b/i.test(source)) addMust("outdoor_pool");
  if (/\b(hot tub|jacuzzi|jetted tub)\b/i.test(source)) addMust("hot_tub");
  if (/\bsauna\b/i.test(source)) addMust("sauna");
  if (/\b(grill|barbecue|barbeque|bbq)\b/i.test(source)) addMust("outdoor_grill");
  if (/\b(full|fully equipped|full size) kitchen\b/i.test(source)) addMust("kitchen");
  else if (/\bkitchenette\b/i.test(source)) addMust("kitchenette");
  else if (/\bkitchen\b/i.test(source)) addMust("kitchen");
  if (/\bfireplace\b/i.test(source)) addMust("fireplace");
  if (/\b(washer|washing machine).{0,20}(dryer)?|washer and dryer|laundry\b/i.test(source)) addMust("washer_dryer");
  if (/\b(balcony|terrace)\b/i.test(source)) addMust("balcony_terrace");
  if (/\bfree parking\b/i.test(source)) addMust("free_parking");
  if (/\bpet friendly|pets allowed\b/i.test(source)) addMust("pet_friendly");
  if (/\b(wi fi|wifi|wireless internet)\b/i.test(source)) addMust("wifi");
  if (/\bair conditioning\b/i.test(source)) addMust("air_conditioning");
  if (mustHave.length) raw.mustHaveAmenities = mustHave;
  if (preferred.length) raw.preferredAmenities = preferred;

  const couplePhrase = /\b(?:my\s+)?(?:gf|girlfriend|boyfriend|partner|wife|husband|spouse)\s+and\s+i\b/i.test(source);
  const explicitParty = source.match(/\b(?:flights?|airfare|tickets?|booking|reservation|trip|travel)\s+for\s+(\d{1,2})\b|\b(?:for|party of|group of)\s+(\d{1,2})\s*(?=(?:adults?|people|persons|travelers?|travellers?|guests?)\b|(?:from|going|leaving|traveling|travelling)\b)/i);
  const adults = source.match(/\b(\d{1,2})\s*(?:adults?|people|persons|travelers|travellers|guests)\b/i);
  if (couplePhrase) raw.adults = 2;
  else if (explicitParty) raw.adults = Number(explicitParty[1] || explicitParty[2]);
  else if (adults) raw.adults = Number(adults[1]);
  const rooms = source.match(/\b(\d{1,2})\s*rooms?\b/i);
  if (rooms) raw.rooms = Number(rooms[1]);

  const parsedBudget = parseCompactBudget(source);
  if (parsedBudget) {
    raw.budget = parsedBudget.amount;
    raw.budgetMode = parsedBudget.mode;
    raw.currency = parsedBudget.currency;
  }

  if (/\b(premium\s*(?:economy|eco)|premium\s+coach|prem\s+eco)\b/i.test(source)) raw.cabinClass = "premium_economy";
  else if (/\b(first class|first cabin)\b/i.test(source)) raw.cabinClass = "first";
  else if (/\b(business class|business cabin)\b/i.test(source)) raw.cabinClass = "business";
  else if (/\b(economy|coach)\b/i.test(source)) raw.cabinClass = "economy";

  if (/\b(nonstop|non stop|direct flight)\b/i.test(source)) raw.stops = "nonstop";
  else if (/\b(up to|maximum of|max)\s+1\s+stop\b/i.test(source) || /\bone stop\b/i.test(source)) raw.stops = "one_stop";
  else if (/\b(up to|maximum of|max)\s+2\s+stops?\b/i.test(source) || /\btwo stops\b/i.test(source)) raw.stops = "two_stops";

  const layovers = extractLayoverCountryPreferences(source);
  if (layovers.preferred.length) raw.preferredLayoverCountries = layovers.preferred;
  if (layovers.avoided.length) raw.avoidLayoverCountries = layovers.avoided;

  const dateTokens = collectDateTokens(source);
  if (dateTokens.length) {
    const first = dateTokens[0];
    const firstContext = source.slice(Math.max(0, first.index - 28), first.index);
    if (/\b(return|returning|back)\b/i.test(firstContext)) {
      const resolved = resolveDateToken(first, todayLocal);
      if (resolved) raw.returnDate = resolved;
    } else {
      const departure = resolveDateToken(first, todayLocal);
      if (departure) raw.departureDate = departure;
      if (dateTokens.length > 1) {
        const second = dateTokens[1];
        const secondContext = source.slice(Math.max(0, second.index - 32), second.index);
        const resolvedReturn = resolveDateToken(second, todayLocal, departure || todayLocal);
        if (resolvedReturn && (!departure || resolvedReturn > departure)) raw.returnDate = resolvedReturn;
        if (!departure && /\b(return|returning|back)\b/i.test(secondContext) && resolvedReturn) raw.returnDate = resolvedReturn;
      }
    }
    // A duration is calendar days inclusive of departure: a 3-day trip
    // leaving Dec 26 returns Dec 28. Nights, by contrast, add their full count.
    const durationMatch = source.match(/\b(?:for|stay(?:ing)?|spend(?:ing)?)\s+(\d{1,2})\s+(days?|nights?)\b/i);
    if (raw.departureDate && !raw.returnDate && durationMatch) {
      const count = Number(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      const dayOffset = unit.startsWith("day") ? Math.max(1, count) - 1 : count;
      if (count >= 1 && count <= 60) raw.returnDate = addCalendarDays(String(raw.departureDate), dayOffset);
    }
    if (dateTokens.some((item) => item.year === undefined) && (raw.departureDate || raw.returnDate)) {
      const dateLabel = [raw.departureDate, raw.returnDate].filter((item): item is string => typeof item === "string").join(" – ");
      raw.notes = [...(Array.isArray(raw.notes) ? raw.notes as string[] : []), `No year was specified. Tripfinder selected the next upcoming date(s): ${dateLabel}. Confirm the year before searching.`];
    }
  }

  const restaurantDistance = source.match(/\brestaurants?\b[^.!?;]{0,90}\bwithin\s+(\d{1,2})\s*(?:mins?|minutes?)\b[^.!?;]{0,70}\b(?:airbnb|rental|property|hotel|stay)\b/i);
  if (restaurantDistance) {
    const minutes = Number(restaurantDistance[1]);
    raw.notes = [...(Array.isArray(raw.notes) ? raw.notes as string[] : []), `Restaurant proximity: target within ${minutes} minutes of the selected Airbnb. Verify drive time after choosing a property with a known address.`];
  }

  if (/\b(entire|whole) (house|home|property|place|cabin|condo|villa)\b|\bprivate (house|home|property|cabin|condo|villa)\b/i.test(source)) raw.staySpaceType = "entire_place";
  else if (/\bprivate room\b/i.test(source)) raw.staySpaceType = "private_room";
  else if (/\bshared room\b/i.test(source)) raw.staySpaceType = "shared_room";

  return sanitizeSearchPreferenceDraft(raw, todayLocal, source);
}

export const SEARCH_PREFERENCE_SYSTEM_PROMPT = [
  "You convert a traveler's plain-language trip description into a partial Tripfinder search-form patch.",
  "Return exactly one JSON object and no markdown. Do not execute searches or claim availability.",
  "Only populate fields explicitly stated or strongly implied by the traveler's request. Use null for every field not requested; never copy a current form value merely because it is present in context.",
  "Treat every description as a new, self-contained trip request, not as an edit to the previous search. Never copy prior form values into this request. Only output values supported by the description; omitted values are reset by the form to its defaults (including economy cabin and no connection-country preferences unless stated).",
  "For US state or country plus city/region, set destination to the parent state/country and destinationArea to the requested city/area. Examples: Poconos, Pennsylvania => destination='Pennsylvania', destinationArea='Poconos'; Punta Cana, Dominican Republic => destination='Dominican Republic', destinationArea='Punta Cana'; Tirana, Albania => destination='Albania', destinationArea='Tirana', destinationAirportCode='TIA'. For a country plus airport code, keep the country in destination and the three-letter code in destinationAirportCode (for example Albania and TIA).",

  "Recognize accommodation intent: hotel => stayTypes=['hotels']; Airbnb, house, cabin, condo, villa, vacation rental or entire home => stayTypes=['vacation_rentals']; both => both. A request to rent a whole house, cabin, condo, villa or entire home means staySpaceType='entire_place'; private room => 'private_room'; shared room => 'shared_room'.",
  "Translate amenities only to these IDs: private_pool, shared_pool, pool, indoor_pool, heated_pool, outdoor_pool, hot_tub, sauna, outdoor_grill, kitchen, kitchenette, fireplace, washer_dryer, balcony_terrace, free_parking, pet_friendly, beach_access, gym, wifi, air_conditioning. Do not infer private_pool from a generic pool. If the traveler says private pool, use private_pool. If community/shared pool, use shared_pool. If simply pool, use pool.",
  "Features phrased as must-have, need, require, or a direct 'with X' condition go into mustHaveAmenities. Features phrased as prefer, ideally, would like, or nice-to-have go into preferredAmenities. Never put the same amenity in both.",
  "Recognize components: airfare/flight => flights; lodging/stay/hotel/rental => stays; sightseeing/tours/activities/restaurants => activities. Do not add unrelated components.",
  "Recognize ground trips explicitly: driving, drive, road trip, or by car does not enable flights unless the traveler separately asks for flights. For a driving trip, preserve the text origin for context but do not create airport codes. Recognize origins whether they appear before or after the destination, e.g. driving to Seneca Falls, New York from NYC.",
  "Recognize route endpoints and explicit three-letter airport codes only when the traveler asks for flights; never treat ordinary words such as 'the' as IATA codes. Validate airport codes against known passenger-airport codes. For example, from NYC to Albania TIA means originAirportCode=NYC, destination=Albania, destinationAirportCode=TIA.",
  "For restaurants and dining requests, include the activities search category and indicate restaurantsRequested=true; Tripfinder displays activities and restaurant results as separate groups.",
  "Recognize avoid/prefer connection-country instructions and populate avoidLayoverCountries and preferredLayoverCountries using canonical country names from the available country options. An avoid instruction must never be put in the preferred list.",
  "Recognize premium eco, premium economy, or premium coach as cabinClass=premium_economy. A phrase like 'flight for 2' means adults=2 unless children are explicitly mentioned.",
  "Allowed tripStyle: any, beach, city, food, nature, romantic, family, adventure, culture. Allowed cabinClass: economy, premium_economy, business, first. Allowed stops: any, nonstop, one_stop, two_stops. Allowed currency: USD, CAD, EUR, GBP. Allowed staySpaceType: any, entire_place, private_room, shared_room.",
  "Dates must be YYYY-MM-DD using the supplied local current date. If a date is ambiguous, omit it and add a short note asking the traveler to confirm. Do not invent missing years or dates.",
  "Budget must be a number without a currency symbol. Distinguish total budget from per-person budget. Adults 1-9, childrenAges 1-17, rooms 1-8.",
  "JSON keys: origin,originAirportCode,destination,destinationArea,destinationAirportCode,departureDate,returnDate,adults,childrenAges,rooms,budget,budgetMode,currency,components,restaurantsRequested,tripStyle,stayTypes,staySpaceType,mustHaveAmenities,preferredAmenities,cabinClass,stops,preferredLayoverCountries,avoidLayoverCountries,minimumHotelRating,freeCancellation,temperatureMin,temperatureMax,temperatureUnit,notes.",
  "For fields not requested, return null. For arrays with no requested values, return null rather than an empty array.",
].join(" ");
