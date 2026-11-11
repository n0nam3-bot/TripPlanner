import type {
  CabinClass,
  StayAmenity,
  StaySpaceType,
  StayType,
  StopPreference,
  TripComponent,
  TripStyle,
} from "@/lib/trip-planner/types";

export type SearchPreferenceDraft = {
  origin?: string;
  destination?: string;
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
  tripStyle?: TripStyle;
  stayTypes?: StayType[];
  staySpaceType?: StaySpaceType;
  mustHaveAmenities?: StayAmenity[];
  preferredAmenities?: StayAmenity[];
  cabinClass?: CabinClass;
  stops?: StopPreference;
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
  if (origin) draft.origin = origin;
  if (destination) draft.destination = destination;
  if (destinationArea) draft.destinationArea = destinationArea;

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
    mustHave = mustHave.map((item) => item === "private_pool" ? (explicitSharedPool ? "shared_pool" : "pool") : item);
    preferred = preferred.map((item) => item === "private_pool" ? (explicitSharedPool ? "shared_pool" : "pool") : item);
  }
  if (!explicitSharedPool) {
    mustHave = mustHave.filter((item) => item !== "shared_pool");
    preferred = preferred.filter((item) => item !== "shared_pool");
  }
  mustHave = [...new Set(mustHave)];
  preferred = [...new Set(preferred)].filter((item) => !mustHave.includes(item));
  const cabinClass = enumValue(raw.cabinClass, cabins);
  const stopPreference = enumValue(raw.stops, stops);
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

export const SEARCH_PREFERENCE_SYSTEM_PROMPT = [
  "You convert a traveler's plain-language trip description into a partial Tripfinder search-form patch.",
  "Return exactly one JSON object and no markdown. Do not execute searches or claim availability.",
  "Only populate fields explicitly stated or strongly implied by the traveler's request. Use null for every field not requested; never copy a current form value merely because it is present in context.",
  "Keep existing choices unchanged unless the traveler explicitly changes them. Output only the changed fields.",
  "For US state or country plus city/region, set destination to the parent state/country and destinationArea to the requested city/area. Examples: Poconos, Pennsylvania => destination='Pennsylvania', destinationArea='Poconos'; Punta Cana, Dominican Republic => destination='Dominican Republic', destinationArea='Punta Cana'. For a standalone city/country, set destination to a clearly qualified city and country and leave destinationArea null.",
  "Recognize accommodation intent: hotel => stayTypes=['hotels']; Airbnb, house, cabin, condo, villa, vacation rental or entire home => stayTypes=['vacation_rentals']; both => both. A request to rent a whole house, cabin, condo, villa or entire home means staySpaceType='entire_place'; private room => 'private_room'; shared room => 'shared_room'.",
  "Translate amenities only to these IDs: private_pool, shared_pool, pool, indoor_pool, heated_pool, outdoor_pool, hot_tub, sauna, outdoor_grill, kitchen, kitchenette, fireplace, washer_dryer, balcony_terrace, free_parking, pet_friendly, beach_access, gym, wifi, air_conditioning. Do not infer private_pool from a generic pool. If the traveler says private pool, use private_pool. If community/shared pool, use shared_pool. If simply pool, use pool.",
  "Features phrased as must-have, need, require, or a direct 'with X' condition go into mustHaveAmenities. Features phrased as prefer, ideally, would like, or nice-to-have go into preferredAmenities. Never put the same amenity in both.",
  "Recognize components: airfare/flight => flights; lodging/stay/hotel/rental => stays; sightseeing/tours/activities/restaurants => activities. Do not add unrelated components.",
  "Allowed tripStyle: any, beach, city, food, nature, romantic, family, adventure, culture. Allowed cabinClass: economy, premium_economy, business, first. Allowed stops: any, nonstop, one_stop, two_stops. Allowed currency: USD, CAD, EUR, GBP. Allowed staySpaceType: any, entire_place, private_room, shared_room.",
  "Dates must be YYYY-MM-DD using the supplied local current date. If a date is ambiguous, omit it and add a short note asking the traveler to confirm. Do not invent missing years or dates.",
  "Budget must be a number without a currency symbol. Distinguish total budget from per-person budget. Adults 1-9, childrenAges 1-17, rooms 1-8.",
  "JSON keys: origin,destination,destinationArea,departureDate,returnDate,adults,childrenAges,rooms,budget,budgetMode,currency,components,tripStyle,stayTypes,staySpaceType,mustHaveAmenities,preferredAmenities,cabinClass,stops,minimumHotelRating,freeCancellation,temperatureMin,temperatureMax,temperatureUnit,notes.",
  "For fields not requested, return null. For arrays with no requested values, return null rather than an empty array.",
].join(" ");
