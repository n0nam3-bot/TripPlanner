import { AIRPORT_METRO_GROUPS } from "./airports";
import type { TripSearchInput } from "./types";

const METRO_AIRPORTS: Record<string, string> = Object.fromEntries(
  AIRPORT_METRO_GROUPS.map((group) => [group.code, group.airportCodes.join(",")]),
);

/**
 * Google Flights accepts comma-separated physical airport alternatives. Keep
 * the Cartesian product bounded so city-wide origin + destination choices do
 * not create a very large search matrix (which can be slow or fail upstream).
 * Preserve the directory's preferred-airport order when trimming alternatives.
 */
export const MAX_AIRPORT_ROUTE_COMBINATIONS = 4;

export function expandAirportPair(originCode: string, destinationCode: string): {
  departureId: string;
  arrivalId: string;
  combinationCount: number;
} {
  const departures = [...new Set(expandOriginAirports(originCode).split(",").map((code) => code.trim()).filter(Boolean))];
  const arrivals = [...new Set(expandDestinationAirports(destinationCode).split(",").map((code) => code.trim()).filter(Boolean))];

  while (departures.length * arrivals.length > MAX_AIRPORT_ROUTE_COMBINATIONS) {
    const canTrimDeparture = departures.length > 1;
    const canTrimArrival = arrivals.length > 1;
    if (!canTrimDeparture && !canTrimArrival) break;

    // Trim the larger side first. On a tie, trim the departure side; this
    // produces balanced 2x2 searches for common 3x2 / 3x5 metro pairs.
    if (canTrimDeparture && (!canTrimArrival || departures.length >= arrivals.length)) {
      departures.pop();
    } else {
      arrivals.pop();
    }
  }

  return {
    departureId: departures.join(","),
    arrivalId: arrivals.join(","),
    combinationCount: departures.length * arrivals.length,
  };
}

export function expandOriginAirports(originCode: string): string {
  return METRO_AIRPORTS[originCode] ?? originCode;
}

/** Expand a selected multi-airport city gateway into its physical airports. */
export function expandDestinationAirports(destinationCode: string): string {
  return METRO_AIRPORTS[destinationCode] ?? destinationCode;
}

/** Build the first Google Flights request. type=1 is a round-trip search. */
export function makeFlightParams(
  input: TripSearchInput,
  originCode: string,
  destinationAirportCode: string,
): Record<string, string> {
  const classMap = { economy: "1", premium_economy: "2", business: "3", first: "4" } as const;
  // Google Flights exposes maximum-stop filters, not exact one-stop/two-stop filters.
  const stopMap = { any: "0", nonstop: "1", one_stop: "2", two_stops: "3" } as const;
  const airportPair = expandAirportPair(originCode, destinationAirportCode);
  return {
    engine: "google_flights",
    departure_id: airportPair.departureId,
    arrival_id: airportPair.arrivalId,
    type: "1",
    outbound_date: input.departureDate,
    return_date: input.returnDate,
    adults: String(input.adults),
    children: String(input.childrenAges.length),
    travel_class: classMap[input.cabinClass],
    stops: stopMap[input.stops],
    currency: input.currency,
    gl: "us",
    hl: "en",
    deep_search: "true",
  };
}

/** Continue the round-trip search using the selected outbound's opaque token. */
export function makeReturnFlightParams(
  input: TripSearchInput,
  originCode: string,
  destinationAirportCode: string,
  departureToken: string,
): Record<string, string> {
  return {
    ...makeFlightParams(input, originCode, destinationAirportCode),
    departure_token: departureToken,
  };
}

/** Request seller offers only after both the outbound and return itinerary are selected. */
export function makeFlightBookingParams(
  input: TripSearchInput,
  originCode: string,
  destinationAirportCode: string,
  bookingToken: string,
): Record<string, string> {
  const original = makeFlightParams(input, originCode, destinationAirportCode);
  return {
    engine: "google_flights",
    type: original.type,
    departure_id: original.departure_id,
    arrival_id: original.arrival_id,
    outbound_date: original.outbound_date,
    return_date: original.return_date,
    adults: original.adults,
    children: original.children,
    travel_class: original.travel_class,
    currency: original.currency,
    gl: original.gl,
    hl: original.hl,
    booking_token: bookingToken,
  };
}
