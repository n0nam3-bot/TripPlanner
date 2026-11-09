import type { CabinClass, StopPreference, TripSearchInput, TripStyle } from "./types";

const styles = new Set<TripStyle>(["any", "beach", "city", "food", "nature", "romantic", "family", "adventure", "culture"]);
const cabins = new Set<CabinClass>(["economy", "premium_economy", "business", "first"]);
const stops = new Set<StopPreference>(["any", "nonstop", "one_stop", "two_stops"]);
const currencies = new Set(["USD", "CAD", "EUR", "GBP"]);

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
  const origin = read(params, "origin", "New York");
  const destination = read(params, "destination", "Anywhere");
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

  if (!origin || origin.length > 90) errors.push("Enter a departure city or three-letter airport code.");
  if (!destination || destination.length > 90) errors.push("Enter a destination or choose Anywhere.");
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

  if (errors.length) return { errors };
  return {
    errors,
    input: {
      origin, destination, departureDate, returnDate, adults, childrenAges, rooms, budget, budgetMode,
      currency, style: styleValue, flexible: flexibleDays > 0, flexibleDays, cabinClass, stops: stopsValue,
      minimumHotelRating: ratingValue as 0 | 3 | 4 | 5, freeCancellation: read(params, "freeCancellation", "false") === "true",
    },
  };
}

export function validateTripSearchInput(value: unknown): { input?: TripSearchInput; errors: string[] } {
  if (!value || typeof value !== "object") return { errors: ["Search input must be an object."] };
  const record = value as Record<string, unknown>;
  const params = new URLSearchParams();
  const mapping: Record<string, string> = {
    origin: "origin", destination: "destination", departureDate: "depart", returnDate: "return", adults: "adults",
    rooms: "rooms", budget: "budget", budgetMode: "budgetMode", currency: "currency", style: "style", flexibleDays: "flexibleDays",
    cabinClass: "cabin", stops: "stops", minimumHotelRating: "hotelRating", freeCancellation: "freeCancellation",
  };
  for (const [source, target] of Object.entries(mapping)) {
    const item = record[source];
    if (item !== undefined && item !== null) params.set(target, String(item));
  }
  if (Array.isArray(record.childrenAges)) params.set("childrenAges", record.childrenAges.map(String).join(","));
  return parseTripSearch(params);
}
