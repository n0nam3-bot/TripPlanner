import type { TripSearchInput } from "./types";

function expandOriginAirports(originCode: string): string {
  const metroAirports: Record<string, string> = {
    NYC: "JFK,EWR,LGA",
    CHI: "ORD,MDW",
    WAS: "DCA,IAD,BWI",
    LON: "LHR,LGW,STN,LTN",
    PAR: "CDG,ORY",
    ROM: "FCO,CIA",
    TYO: "HND,NRT",
  };
  return metroAirports[originCode] ?? originCode;
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
  return {
    engine: "google_flights",
    departure_id: expandOriginAirports(originCode),
    arrival_id: destinationAirportCode,
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
