import type { TripSearchInput } from "./types";
import { expandOriginAirports } from "./flight-search-params";

export type FlexibleFlightDateOption = {
  departureDate: string;
  returnDate: string;
  price: number;
  currency: string;
  lowPrice: boolean;
};

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

export function addIsoDays(value: string, days: number): string {
  const parsed = parseIsoDate(value);
  if (!parsed || !Number.isInteger(days)) throw new Error("INVALID_FLEXIBLE_DATE");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function tripDurationDays(departureDate: string, returnDate: string): number {
  const departure = parseIsoDate(departureDate);
  const returning = parseIsoDate(returnDate);
  if (!departure || !returning || returning <= departure) throw new Error("INVALID_FLEXIBLE_DATE_RANGE");
  return Math.round((returning.getTime() - departure.getTime()) / 86400000);
}

/**
 * One Google Flights Calendar API request compares the same trip length across
 * a bounded window. It does not retrieve itineraries or apply stop/country
 * connection filters; those are enforced by the exact-date flight search
 * after the traveler chooses a date pair.
 */
export function makeFlexibleFlightCalendarParams(
  input: TripSearchInput,
  originCode: string,
  destinationAirportCode: string,
  today = new Date().toISOString().slice(0, 10),
): Record<string, string> {
  if (!Number.isInteger(input.flexibleDays) || input.flexibleDays < 1 || input.flexibleDays > 3) {
    throw new Error("INVALID_FLEXIBLE_DATE_WINDOW");
  }
  if (!/^[A-Z]{3}$/.test(destinationAirportCode)) throw new Error("DESTINATION_AIRPORT_UNRESOLVED");
  const requestedStart = addIsoDays(input.departureDate, -input.flexibleDays);
  const dateRangeStart = requestedStart < today ? today : requestedStart;
  const dateRangeEnd = addIsoDays(input.departureDate, input.flexibleDays);
  if (dateRangeEnd < dateRangeStart) throw new Error("INVALID_FLEXIBLE_DATE_WINDOW");

  const cabin = { economy: "1", premium_economy: "2", business: "3", first: "4" } as const;
  return {
    engine: "google_flights_calendar",
    type: "1",
    departure_id: expandOriginAirports(originCode),
    arrival_id: destinationAirportCode,
    date_range_start: dateRangeStart,
    date_range_end: dateRangeEnd,
    round_trip_days: String(tripDurationDays(input.departureDate, input.returnDate)),
    fixed_outbound_date: "false",
    adults: String(input.adults),
    children: String(input.childrenAges.length),
    travel_class: cabin[input.cabinClass],
    currency: input.currency,
    gl: "us",
    hl: "en",
  };
}

export function normalizeFlexibleFlightDateOptions(
  values: unknown,
  currency: string,
  requestedStart: string,
  requestedEnd: string,
): FlexibleFlightDateOption[] {
  if (!Array.isArray(values)) return [];
  const options = values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const departureDate = typeof row.outbound_date === "string" ? row.outbound_date : "";
    const returnDate = typeof row.return_date === "string" ? row.return_date : "";
    const price = typeof row.price === "number" ? row.price : Number(row.price);
    if (!parseIsoDate(departureDate) || !parseIsoDate(returnDate) || !Number.isFinite(price) || price <= 0) return [];
    if (departureDate < requestedStart || departureDate > requestedEnd || returnDate <= departureDate) return [];
    return [{ departureDate, returnDate, price, currency, lowPrice: row.low_price === true }];
  });
  return [...new Map(options.map((option) => [`${option.departureDate}|${option.returnDate}`, option])).values()]
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate));
}
