const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const { parseDeterministicSearchPreferenceDraft, sanitizeSearchPreferenceDraft } = require("../../.test-build/lib/ai/search-preferences.js");
const { getLocationSuggestions } = require("../../.test-build/lib/trip-planner/location-suggestions.js");
const { airportCountry, airportTimeZone, formatFlightTimeAtAirport, flightLayoverDuration, flightTimeSortTimestamp } = require("../../.test-build/lib/trip-planner/flight-routing.js");
const { makeFlightParams, makeReturnFlightParams, makeFlightBookingParams } = require("../../.test-build/lib/trip-planner/flight-search-params.js");
const { applyLayoverPreferences } = require("../../.test-build/lib/trip-planner/flight-search-policy.js");
const { safeGoogleBookingUrl } = require("../../.test-build/lib/trip-planner/flight-booking-url.js");
const { parseTripSearch } = require("../../.test-build/lib/trip-planner/validation.js");

function baseInput(overrides = {}) {
  return {
    origin: "New York (NYC)", originAirportCode: "NYC", destination: "Albania", destinationArea: "", destinationAirportCode: "TIA",
    components: ["flights"], stayTypes: ["hotels", "vacation_rentals"], staySpaceType: "any", stayMustHaveAmenities: [], stayPreferredAmenities: [],
    departureDate: "2027-06-26", returnDate: "2027-07-09", adults: 2, childrenAges: [], rooms: 1, budget: 4000, budgetMode: "total",
    currency: "USD", style: "any", flexible: false, flexibleDays: 0, cabinClass: "premium_economy", stops: "any",
    preferredLayoverCountries: [], avoidLayoverCountries: [], minimumHotelRating: 0, freeCancellation: false,
    temperatureMin: null, temperatureMax: null, temperatureUnit: "F", planningNotes: [],
    ...overrides,
  };
}

test("Albania flight request extracts the complete set of explicit preferences", () => {
  const draft = parseDeterministicSearchPreferenceDraft(
    "flight for 2 from nyc to albania tia on june 26 and return on july 9. our flight budget it $4000. avoid stops to serbia. i would like to travel premium eco",
    "2026-11-12",
  );
  assert.equal(draft.originAirportCode, "NYC");
  assert.equal(draft.destination, "Albania");
  assert.equal(draft.destinationAirportCode, "TIA");
  assert.equal(draft.adults, 2);
  assert.equal(draft.departureDate, "2027-06-26");
  assert.equal(draft.returnDate, "2027-07-09");
  assert.equal(draft.budget, 4000);
  assert.equal(draft.budgetMode, "total");
  assert.equal(draft.cabinClass, "premium_economy");
  assert.deepEqual(draft.avoidLayoverCountries, ["Serbia"]);
});

test("Las Terrenas request separates destination area from flight airport and calculates inclusive trip days", () => {
  const draft = parseDeterministicSearchPreferenceDraft(
    "a flight from jfk to sti for an airbnb beachfront in las terrenas dominican republic. on dec 26 for 3 days with a budget of 2.5k for my gf and i. the flight should be nonstop and we would like restaurants that are within 5 mins from the airbnb",
    "2026-11-12",
  );
  assert.equal(draft.originAirportCode, "JFK");
  assert.equal(draft.destination, "Dominican Republic");
  assert.equal(draft.destinationArea, "Las Terrenas");
  assert.equal(draft.destinationAirportCode, "STI");
  assert.equal(draft.departureDate, "2026-12-26");
  assert.equal(draft.returnDate, "2026-12-28");
  assert.equal(draft.adults, 2);
  assert.equal(draft.budget, 2500);
  assert.deepEqual(draft.stayTypes, ["vacation_rentals"]);
  assert.equal(draft.stops, "nonstop");
  assert.equal(draft.cabinClass, undefined, "an unspecified cabin is left unset so the form's Economy default applies");
  assert.equal(draft.avoidLayoverCountries, undefined, "no old avoid-country choice should be inferred from this prompt");
  assert.ok(draft.notes.some((note) => /within 5 minutes of the selected Airbnb/i.test(note)));
});


test("Seneca Falls driving request keeps destination, dates, party, budget and restaurants without inventing flights", () => {
  const draft = parseDeterministicSearchPreferenceDraft(
    "i am driving to the Seneca Falls, New York from NYC on dec 25th to the 27th. total of 2 people and would like to know what activities and restaurants i could go to. my budget is 1k",
    "2026-11-13",
  );
  assert.equal(draft.destination, "New York");
  assert.equal(draft.destinationArea, "Seneca Falls");
  assert.equal(draft.origin, "NYC");
  assert.equal(draft.originAirportCode, undefined);
  assert.equal(draft.destinationAirportCode, undefined);
  assert.deepEqual(draft.components, ["activities"]);
  assert.equal(draft.restaurantsRequested, true);
  assert.equal(draft.departureDate, "2026-12-25");
  assert.equal(draft.returnDate, "2026-12-27");
  assert.equal(draft.adults, 2);
  assert.equal(draft.budget, 1000);
  assert.equal(draft.budgetMode, "total");
  assert.ok(draft.notes.some((note) => /Driving trip: from NYC; flights are not requested/i.test(note)));
  assert.ok(draft.notes.some((note) => /No year was specified/i.test(note)));
});

test("ordinary word THE is never accepted as a destination airport code", () => {
  const draft = sanitizeSearchPreferenceDraft({ destination: "New York", destinationAirportCode: "THE", components: ["activities"] }, "2026-11-13", "Driving to Seneca Falls from NYC");
  assert.equal(draft.destinationAirportCode, undefined);
  assert.equal(draft.components.includes("flights"), false);
});

test("Seneca Falls is available as a New York state-scoped destination area", () => {
  const results = getLocationSuggestions("Seneca Falls", "destination", true, false, "New York");
  assert.ok(results.some((item) => item.label === "Seneca Falls" && item.value === "Seneca Falls, New York"));
});


test("ground-only search preserves parent state and city area without inheriting a default airport", () => {
  const parsed = parseTripSearch(new URLSearchParams({
    origin: "NYC", originAirportCode: "", destination: "New York", destinationArea: "Seneca Falls",
    destinationAirportCode: "", components: "activities", depart: "2026-12-25", return: "2026-12-27",
    adults: "2", rooms: "1", budget: "1000", budgetMode: "total", currency: "USD",
    style: "any", flexibleDays: "0", cabin: "economy", stops: "any", hotelRating: "0",
  }));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.input.destination, "New York");
  assert.equal(parsed.input.destinationArea, "Seneca Falls");
  assert.equal(parsed.input.origin, "NYC");
  assert.equal(parsed.input.originAirportCode, "");
  assert.equal(parsed.input.destinationAirportCode, "");
  assert.deepEqual(parsed.input.components, ["activities"]);
});

test("round-trip request builder sends both dates, traveler count, cabin and stops", () => {
  const params = makeFlightParams(baseInput(), "NYC", "TIA");
  assert.equal(params.engine, "google_flights");
  assert.equal(params.type, "1");
  assert.equal(params.departure_id, "JFK,EWR,LGA");
  assert.equal(params.arrival_id, "TIA");
  assert.equal(params.outbound_date, "2027-06-26");
  assert.equal(params.return_date, "2027-07-09");
  assert.equal(params.adults, "2");
  assert.equal(params.travel_class, "2");
  assert.equal(params.stops, "0");
});

test("return stage retains round-trip context and adds only the selected outbound token", () => {
  const params = makeReturnFlightParams(baseInput(), "NYC", "TIA", "outbound-token-fixture");
  assert.equal(params.type, "1");
  assert.equal(params.outbound_date, "2027-06-26");
  assert.equal(params.return_date, "2027-07-09");
  assert.equal(params.departure_token, "outbound-token-fixture");
  assert.equal(params.booking_token, undefined);
});

test("seller stage preserves original trip context and adds the selected booking token", () => {
  const params = makeFlightBookingParams(baseInput(), "NYC", "TIA", "round-trip-booking-token");
  assert.equal(params.type, "1");
  assert.equal(params.outbound_date, "2027-06-26");
  assert.equal(params.return_date, "2027-07-09");
  assert.equal(params.departure_id, "JFK,EWR,LGA");
  assert.equal(params.arrival_id, "TIA");
  assert.equal(params.booking_token, "round-trip-booking-token");
  assert.equal(params.departure_token, undefined);
});

test("connection-country filter removes Serbia stopovers and withholds unknown stops when avoid list is active", () => {
  const flights = [
    { id: "serbia", stops: 1, segments: [{ toAirportCode: "BEG" }, { toAirportCode: "TIA" }] },
    { id: "germany", stops: 1, segments: [{ toAirportCode: "FRA" }, { toAirportCode: "TIA" }] },
    { id: "unknown", stops: 1, segments: [{ toAirportCode: "ZZZ" }, { toAirportCode: "TIA" }] },
    { id: "nonstop", stops: 0, segments: [{ toAirportCode: "TIA" }] },
  ];
  const result = applyLayoverPreferences(flights, { preferredLayoverCountries: [], avoidLayoverCountries: ["Serbia"] });
  assert.deepEqual(result.flights.map((flight) => flight.id), ["germany", "nonstop"]);
  assert.equal(airportCountry("BEG"), "Serbia");
  assert.ok(result.warnings.some((warning) => /removed because a connection airport is in a country on the avoid list/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /could not verify the country/i.test(warning)));
});

test("preferred connection countries rank matching eligible routes first", () => {
  const flights = [
    { id: "france", stops: 1, segments: [{ toAirportCode: "CDG" }, { toAirportCode: "TIA" }] },
    { id: "germany", stops: 1, segments: [{ toAirportCode: "FRA" }, { toAirportCode: "TIA" }] },
  ];
  const result = applyLayoverPreferences(flights, { preferredLayoverCountries: ["Germany"], avoidLayoverCountries: [] });
  assert.deepEqual(result.flights.map((flight) => flight.id), ["germany", "france"]);
});

test("flight events display in the event airport's local timezone, including DST", () => {
  assert.equal(airportTimeZone("JFK"), "America/New_York");
  assert.equal(airportTimeZone("STI"), "America/Santo_Domingo");
  assert.match(formatFlightTimeAtAirport("2026-12-26 19:38", "JFK"), /7:38\s*PM\s*EST/);
  assert.match(formatFlightTimeAtAirport("2026-12-26 23:29", "STI"), /11:29\s*PM\s*AST/);
  assert.match(formatFlightTimeAtAirport("2027-07-10 19:38", "JFK"), /7:38\s*PM\s*EDT/);
});

test("flight timeline timestamps sort across timezones and layovers use connection-airport time", () => {
  const jfk = flightTimeSortTimestamp("2026-12-26 19:38", "JFK");
  const sti = flightTimeSortTimestamp("2026-12-26 23:29", "STI");
  assert.ok(jfk !== null && sti !== null && sti > jfk);
  assert.equal(flightLayoverDuration("2026-12-26 10:00", "2026-12-26 12:35", "FRA"), "2h 35m");
  assert.equal(flightLayoverDuration("not listed", "2026-12-26 12:35", "FRA"), null);
});


test("Google booking redirect accepts only the exact HTTPS Google flight redirect host and path", () => {
  const valid = "https://www.google.com/travel/clk/f?u=opaque-token";
  assert.equal(safeGoogleBookingUrl(valid), valid);
  assert.equal(safeGoogleBookingUrl("http://www.google.com/travel/clk/f?u=x"), undefined);
  assert.equal(safeGoogleBookingUrl("https://google.com.evil.example/travel/clk/f?u=x"), undefined);
  assert.equal(safeGoogleBookingUrl("https://evil.example/travel/clk/f?u=x"), undefined);
  assert.equal(safeGoogleBookingUrl("https://www.google.com/travel/flights?q=NYC-TIA"), undefined);
  assert.equal(safeGoogleBookingUrl("not-a-url"), undefined);
});

test("Seneca Falls review displays driving origin, start/end dates, and both requested place categories", () => {
  const source = fs.readFileSync("components/trip-search.tsx", "utf8");
  assert.match(source, /preferenceDraft\.notes\?\.some\(\(note\) => \/\^Driving trip:\/i\.test\(note\)\) \? "Driving from" : "Leaving from"/);
  assert.match(source, /preferenceDraft\.restaurantsRequested \? "Activities & attractions \+ Restaurants & dining"/);
  assert.match(source, /components\?\.includes\("flights"\) \? "Depart" : "Start"/);
  assert.match(source, /components\?\.includes\("flights"\) \? "Return" : "End"/);
  assert.match(source, /const selectedOriginCode = searchingFlights \?/);
  assert.match(source, /destinationAirportCode: searchingFlights \?/);
});
