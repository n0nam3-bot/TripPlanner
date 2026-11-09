import type { CabinClass, StopPreference, StayType, TripComponent, TripSearchInput, TripStyle } from "./types";

const styles = new Set<TripStyle>(["any", "beach", "city", "food", "nature", "romantic", "family", "adventure", "culture"]);
const cabins = new Set<CabinClass>(["economy", "premium_economy", "business", "first"]);
const stops = new Set<StopPreference>(["any", "nonstop", "one_stop", "two_stops"]);
const currencies = new Set(["USD", "CAD", "EUR", "GBP"]);
const tripComponents = new Set<TripComponent>(["flights", "stays", "activities"]);
const stayTypes = new Set<StayType>(["hotels", "vacation_rentals"]);

function read(params: URLSearchParams, key: string, fallback: string): string {
  return params.get(key)?.trim() || fallback;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function parseTripSearch(params: URLSearchParams): { input?: TripSearchInput; errors: string[] } {
  const errors: string[] = [];
  const origin = read(params, "origin", "New York (NYC)");
  const originAirportCode = read(params, "originAirportCode", "NYC").toUpperCase();
  const destination = read(params, "destination", "Anywhere");
  const destinationAirportCode = read(params, "destinationAirportCode", "").toUpperCase();
  const rawComponents = read(params, "components", "flights,stays,activities").split(",").filter(Boolean) as TripComponent[];
  const components = [...new Set(rawComponents.filter((item) => tripComponents.has(item)))];
  const rawStayTypes = read(params, "stayTypes", "hotels,vacation_rentals").split(",").filter(Boolean) as StayType[];
  const selectedStayTypes = [...new Set(rawStayTypes.filter((item) => stayTypes.has(item)))];
  const departureDate = read(params, "depart", "");
  const returnDate = read(params, "return", "");
  const adults = Number(read(params, "adults", "2"));
  const rawAges = read(params, "childrenAges", "");
  const childrenAges = rawAges ? rawAges.split(/[ ,]+/).filter(Boolean).map(Number) : [];
  const rooms = Number(read(params, "rooms", "1"));
  const budget = Number(read(params, "budget", "2500"));
  const styleValue = read(params, "style", "any") as TripStyle;
  const budgetMode = read(params, "budgetMode", "total") === "per_person" ? "per_person" : "total";
  const currency = read(params, "currency", "USD").toUpperCase();
  const flexibleDays = Number(read(params, "flexibleDays", "0"));
  const cabinClass = read(params, "cabin", "economy") as CabinClass;
  const stopsValue = read(params, "stops", "any") as StopPreference;
  const ratingValue = Number(read(params, "hotelRating", "0"));
  const temperatureMinRaw = params.get("temperatureMin")?.trim() ?? "";
  const temperatureMaxRaw = params.get("temperatureMax")?.trim() ?? "";
  const temperatureMin = temperatureMinRaw === "" ? null : Number(temperatureMinRaw);
  const temperatureMax = temperatureMaxRaw === "" ? null : Number(temperatureMaxRaw);
  const temperatureUnitValue = read(params, "temperatureUnit", "F").toUpperCase();
  const temperatureUnit = temperatureUnitValue === "C" ? "C" : "F";

  if (components.length === 0) errors.push("Choose at least one: flights, stays or things to do.");
  if (components.includes("flights") && (!origin || origin.length > 90)) errors.push("Enter a departure city or airport.");
  if (!destination || destination.length > 120) errors.push("Enter a destination or choose Anywhere.");
  if (components.includes("flights") && originAirportCode && !/^[A-Z]{3}$/.test(originAirportCode)) errors.push("Choose a valid departure airport.");
  if (destinationAirportCode && !/^[A-Z]{3}$/.test(destinationAirportCode)) errors.push("Choose a valid destination airport.");
  if (components.includes("stays") && selectedStayTypes.length === 0) errors.push("Choose hotels, vacation rentals, or both.");
  if (!validDate(departureDate) || !validDate(returnDate)) errors.push("Enter valid departure and return dates.");
  if (validDate(departureDate) && validDate(returnDate) && returnDate <= departureDate) errors.push("Return date must be after departure date.");
  if (validDate(departureDate) && new Date(`${departureDate}T00:00:00Z`).getTime() < Date.now() - 86400000) errors.push("Departure date must be today or later.");
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) errors.push("Adults must be between 1 and 9.");
  if (childrenAges.some((age) => !Number.isInteger(age) || age < 1 || age > 17) || childrenAges.length > 8) errors.push("Enter children's ages as whole numbers from 1 to 17, separated by commas.");
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > 8) errors.push("Rooms must be between 1 and 8.");
  if (!Number.isFinite(budget) || budget < 50 || budget > 1000000) errors.push("Enter a budget between 50 and 1,000,000.");
  if (!styles.has(styleValue)) errors.push("Choose a valid trip style.");
  if (!currencies.has(currency)) errors.push("Choose a supported currency.");
  if (!Number.isInteger(flexibleDays) || flexibleDays < 0 || flexibleDays > 7) errors.push("Date flexibility must be between 0 and 7 days.");
  if (!cabins.has(cabinClass)) errors.push("Choose a valid cabin class.");
  if (!stops.has(stopsValue)) errors.push("Choose a valid stop preference.");
  if (![0, 3, 4, 5].includes(ratingValue)) errors.push("Choose a valid minimum hotel rating.");
  if (temperatureUnitValue !== "F" && temperatureUnitValue !== "C") errors.push("Choose Fahrenheit or Celsius for the temperature preference.");
  const temperatureMinBound = temperatureUnit === "F" ? -40 : -40;
  const temperatureMaxBound = temperatureUnit === "F" ? 130 : 55;
  if (temperatureMin !== null && (!Number.isFinite(temperatureMin) || temperatureMin < temperatureMinBound || temperatureMin > temperatureMaxBound)) errors.push(`Minimum temperature must be between ${temperatureMinBound} and ${temperatureMaxBound}°${temperatureUnit}.`);
  if (temperatureMax !== null && (!Number.isFinite(temperatureMax) || temperatureMax < temperatureMinBound || temperatureMax > temperatureMaxBound)) errors.push(`Maximum temperature must be between ${temperatureMinBound} and ${temperatureMaxBound}°${temperatureUnit}.`);
  if (temperatureMin !== null && temperatureMax !== null && temperatureMin >= temperatureMax) errors.push("Maximum temperature must be higher than minimum temperature.");

  if (errors.length) return { errors };
  return {
    errors,
    input: {
      origin, originAirportCode, destination, destinationAirportCode, components, stayTypes: selectedStayTypes, departureDate, returnDate, adults, childrenAges, rooms, budget, budgetMode,
      currency, style: styleValue, flexible: flexibleDays > 0, flexibleDays, cabinClass, stops: stopsValue,
      minimumHotelRating: ratingValue as 0 | 3 | 4 | 5, freeCancellation: read(params, "freeCancellation", "false") === "true",
      temperatureMin, temperatureMax, temperatureUnit,
    },
  };
}

export function validateTripSearchInput(value: unknown): { input?: TripSearchInput; errors: string[] } {
  if (!value || typeof value !== "object") return { errors: ["Search input must be an object."] };
  const record = value as Record<string, unknown>;
  const params = new URLSearchParams();
  const mapping: Record<string, string> = {
    origin: "origin", originAirportCode: "originAirportCode", destination: "destination", destinationAirportCode: "destinationAirportCode", components: "components", stayTypes: "stayTypes", departureDate: "depart", returnDate: "return", adults: "adults",
    rooms: "rooms", budget: "budget", budgetMode: "budgetMode", currency: "currency", style: "style", flexibleDays: "flexibleDays",
    cabinClass: "cabin", stops: "stops", minimumHotelRating: "hotelRating", freeCancellation: "freeCancellation",
    temperatureMin: "temperatureMin", temperatureMax: "temperatureMax", temperatureUnit: "temperatureUnit",
  };
  for (const [source, target] of Object.entries(mapping)) {
    const item = record[source];
    if (item !== undefined && item !== null) params.set(target, Array.isArray(item) ? item.map(String).join(",") : String(item));
  }
  if (Array.isArray(record.childrenAges)) params.set("childrenAges", record.childrenAges.map(String).join(","));
  return parseTripSearch(params);
}
