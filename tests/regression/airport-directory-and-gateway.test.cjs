const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AIRPORT_DIRECTORY,
  AIRPORT_METRO_GROUPS,
  resolveAirportCode,
  searchAirportDirectory,
} = require("../../.test-build/lib/trip-planner/airports.js");
const {
  getDestinationGateways,
  getLocationSuggestions,
  destinationMetadata,
} = require("../../.test-build/lib/trip-planner/location-suggestions.js");
const { airportCountry, airportTimeZone } = require("../../.test-build/lib/trip-planner/flight-routing.js");
const { expandDestinationAirports, expandAirportPair, MAX_AIRPORT_ROUTE_COMBINATIONS, makeFlightParams, makeReturnFlightParams, makeFlightBookingParams } = require("../../.test-build/lib/trip-planner/flight-search-params.js");
const { makeFlexibleFlightCalendarParams } = require("../../.test-build/lib/trip-planner/flexible-flight-dates.js");

function input(overrides = {}) {
  return {
    origin: "New York (NYC)", originAirportCode: "NYC", destination: "London, United Kingdom", destinationArea: "",
    destinationAirportCode: "LON", departureDate: "2027-06-26", returnDate: "2027-07-09", adults: 2,
    childrenAges: [], rooms: 1, budget: 4000, budgetMode: "total", currency: "USD", cabinClass: "economy",
    stops: "any", components: ["flights"], stayTypes: ["hotels"], staySpaceType: "any", stayMustHaveAmenities: [],
    stayPreferredAmenities: [], preferredLayoverCountries: [], avoidLayoverCountries: [], minimumHotelRating: 0,
    freeCancellation: false, temperatureMin: null, temperatureMax: null, temperatureUnit: "F", planningNotes: [],
    flexible: false, flexibleDays: 1, ...overrides,
  };
}

test("curated airport directory covers a broad set of passenger gateways", () => {
  assert.ok(AIRPORT_DIRECTORY.length >= 130, `expected at least 130 entries, got ${AIRPORT_DIRECTORY.length}`);
  assert.ok(AIRPORT_METRO_GROUPS.length >= 8);
  assert.ok(AIRPORT_DIRECTORY.every((airport) => /^[A-Z]{3}$/.test(airport.code) && airport.city && airport.name && airport.country && airport.timeZone));
});

test("airport resolution recognizes city, airport-name, alias, parenthetical code and direct IATA input", () => {
  assert.equal(resolveAirportCode("London, United Kingdom"), "LON");
  assert.equal(resolveAirportCode("London Heathrow Airport"), "LHR");
  assert.equal(resolveAirportCode("John F. Kennedy International Airport (JFK)"), "JFK");
  assert.equal(resolveAirportCode("Bali airport"), "DPS");
  assert.equal(resolveAirportCode("Tirana International Airport"), "TIA");
  assert.equal(resolveAirportCode("YTO"), "YTO");
});

test("origin autocomplete finds international airports by city, airport name and IATA code", () => {
  assert.ok(getLocationSuggestions("Heathrow", "origin").some((item) => item.airportCode === "LHR"));
  assert.ok(getLocationSuggestions("LIS", "origin").some((item) => item.airportCode === "LIS"));
  assert.ok(getLocationSuggestions("Bali", "origin").some((item) => item.airportCode === "DPS"));
  assert.ok(getLocationSuggestions("London", "origin").some((item) => item.airportCode === "LON" && item.label.includes("Major airports")));
});

test("destination autocomplete returns exact airports and major-airport metro choices", () => {
  const london = getLocationSuggestions("London", "destination", false, true);
  assert.ok(london.some((item) => item.airportCode === "LON" && item.label.includes("Major airports")));
  assert.ok(london.some((item) => item.airportCode === "LHR"));
  assert.ok(london.some((item) => item.airportCode === "LGW"));
  const tirana = getLocationSuggestions("Tirana International Airport", "destination", false, true);
  assert.ok(tirana.some((item) => item.airportCode === "TIA"));
  assert.ok(tirana.find((item) => item.airportCode === "TIA").value.includes("Albania"));
  const jfk = getLocationSuggestions("JFK", "destination", false, true);
  assert.ok(jfk.some((item) => item.airportCode === "JFK" && item.value.includes("New York")));
});

test("country and metro gateway selection expose practical alternatives", () => {
  const uk = getDestinationGateways("United Kingdom").map((item) => item.code);
  for (const code of ["LON", "LHR", "LGW", "STN", "MAN", "EDI"]) assert.ok(uk.includes(code), `missing ${code}`);
  const italy = getDestinationGateways("Italy").map((item) => item.code);
  for (const code of ["ROM", "FCO", "CIA", "MIL", "MXP", "LIN", "VCE", "NAP"]) assert.ok(italy.includes(code), `missing ${code}`);
  const london = getDestinationGateways("London, United Kingdom").map((item) => item.code);
  assert.deepEqual(london, ["LON", "LHR", "LGW", "STN", "LTN", "LCY"]);
});

test("destination metadata resolves an airport city into a local city and country", () => {
  assert.deepEqual(destinationMetadata("London, United Kingdom"), { city: "London", country: "United Kingdom", airportCode: "LON" });
  assert.deepEqual(destinationMetadata("Lisbon, Portugal"), { city: "Lisbon", country: "Portugal", airportCode: "LIS" });
});

test("multi-airport destination selections expand for exact and flexible round-trip searches", () => {
  assert.equal(expandDestinationAirports("LON"), "LHR,LGW,STN,LTN,LCY");
  assert.equal(expandDestinationAirports("LHR"), "LHR");
  const params = makeFlightParams(input(), "NYC", "LON");
  assert.equal(params.departure_id, "JFK,EWR");
  assert.equal(params.arrival_id, "LHR,LGW");
  assert.equal(params.departure_id.split(",").length * params.arrival_id.split(",").length, MAX_AIRPORT_ROUTE_COMBINATIONS);
  const single = makeFlightParams(input(), "JFK", "LHR");
  assert.equal(single.departure_id, "JFK");
  assert.equal(single.arrival_id, "LHR");
  const boundedOriginOnly = expandAirportPair("JFK", "LON");
  assert.deepEqual(boundedOriginOnly, { departureId: "JFK", arrivalId: "LHR,LGW,STN,LTN", combinationCount: 4 });

  const returning = makeReturnFlightParams(input(), "NYC", "LON", "outbound-token");
  assert.equal(returning.departure_id, "JFK,EWR");
  assert.equal(returning.arrival_id, "LHR,LGW");
  assert.equal(returning.departure_token, "outbound-token");

  const booking = makeFlightBookingParams(input(), "NYC", "LON", "round-trip-booking-token");
  assert.equal(booking.departure_id, "JFK,EWR");
  assert.equal(booking.arrival_id, "LHR,LGW");
  assert.equal(booking.booking_token, "round-trip-booking-token");

  const flexible = makeFlexibleFlightCalendarParams(input({ flexibleDays: 2 }), "NYC", "LON", "2027-06-01");
  assert.equal(flexible.departure_id, "JFK,EWR");
  assert.equal(flexible.arrival_id, "LHR,LGW");
  assert.equal(flexible.departure_id.split(",").length * flexible.arrival_id.split(",").length, 4);
});

test("airport directory keeps timezone and country classification synchronized", () => {
  for (const [code, country, zone] of [["LHR", "United Kingdom", "Europe/London"], ["FAO", "Portugal", "Europe/Lisbon"], ["DPS", "Indonesia", "Asia/Makassar"], ["BQN", "Puerto Rico", "America/Puerto_Rico"]]) {
    assert.equal(airportCountry(code), country);
    assert.equal(airportTimeZone(code), zone);
  }
});

test("airport directory search is ranked and capped to a bounded local result set", () => {
  assert.equal(searchAirportDirectory("LHR", 10)[0].code, "LHR");
  assert.ok(searchAirportDirectory("Tokyo", 10).some((item) => item.code === "HND"));
  assert.ok(searchAirportDirectory("Tokyo", 10).some((item) => item.code === "NRT"));
  assert.ok(searchAirportDirectory("Airport", 1).length <= 1);
});

test("multi-airport route matrix stays within four provider combinations", () => {
  for (const [origin, destination] of [["NYC", "LON"], ["NYC", "TYO"], ["WAS", "PAR"], ["LON", "TIA"], ["LON", "PAR"], ["JFK", "LON"]]) {
    const pair = expandAirportPair(origin, destination);
    assert.ok(pair.combinationCount >= 1 && pair.combinationCount <= 4, `${origin}/${destination} expanded to ${pair.combinationCount}`);
    assert.equal(pair.departureId.split(",").length * pair.arrivalId.split(",").length, pair.combinationCount);
  }
});
