const test = require("node:test");
const assert = require("node:assert/strict");

const { buildTripCostLedger, parseCostEstimate } = require("../../.test-build/lib/trip-planner/cost-ledger.js");
const { parseTripSearch, validateTripSearchInput } = require("../../.test-build/lib/trip-planner/validation.js");

function ledgerInput(overrides = {}) {
  return {
    currency: "USD", nights: 2, budget: 2500, flightRequested: true, stayRequested: true, activitiesRequested: true,
    outbound: { price: 1341, currency: "USD" }, returnFlight: { price: 1341, currency: "USD" }, flightSeller: null,
    hotel: { name: "Beachfront rental", totalPrice: 367, nightlyPrice: 183.5, currency: "USD" },
    activities: [], restaurants: [], manual: { groundTransport: null, activities: null, dining: null }, contingencyPercent: 0,
    ...overrides,
  };
}

function validSearchParams(overrides = {}) {
  const params = new URLSearchParams({
    origin: "New York", originAirportCode: "JFK", destination: "Dominican Republic", destinationArea: "Las Terrenas", destinationAirportCode: "STI",
    components: "flights,stays,activities", stayTypes: "vacation_rentals", depart: "2026-12-26", return: "2026-12-28",
    adults: "2", rooms: "1", budget: "2500", budgetMode: "total", currency: "USD", cabin: "economy", stops: "nonstop",
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, String(value));
  }
  return params;
}

test("initial flight and matching return prices are not added as two one-way tickets", () => {
  const result = buildTripCostLedger(ledgerInput());
  const flightRows = result.rows.filter((row) => row.id.startsWith("flight"));
  assert.equal(flightRows.length, 1);
  assert.equal(flightRows[0].amount, 1341);
  assert.equal(flightRows[0].includedInSubtotal, false);
  assert.equal(result.referenceOnlyTotal, 1341);
  assert.equal(result.pricedSubtotal, 367);
});

test("seller combined or separate-ticket display price appears once, with leg prices only in detail", () => {
  const result = buildTripCostLedger(ledgerInput({
    flightSeller: { price: 1250, currency: "USD", seller: "Airline pair", type: "Separate tickets", departingPrice: 700, returningPrice: 550, departingSeller: "Airline A", returningSeller: "Airline B" },
  }));
  const flightRows = result.rows.filter((row) => row.id.startsWith("flight"));
  assert.equal(flightRows.length, 1);
  assert.equal(flightRows[0].amount, 1250);
  assert.equal(result.referenceOnlyTotal, 1250);
  assert.match(flightRows[0].detail, /outbound USD 700\.00/);
  assert.match(flightRows[0].detail, /return USD 550\.00/);
});

test("foreign-currency stay totals remain references and are not silently converted", () => {
  const result = buildTripCostLedger(ledgerInput({ hotel: { name: "Rental", totalPrice: 500, nightlyPrice: 250, currency: "EUR" } }));
  const stay = result.rows.find((row) => row.id === "stay");
  assert.equal(stay.includedInSubtotal, false);
  assert.equal(stay.status, "reference_only");
  assert.equal(result.pricedSubtotal, 0);
});

test("blank estimates remain unpriced rather than being treated as free", () => {
  const result = buildTripCostLedger(ledgerInput({ manual: { groundTransport: null, activities: null, dining: null } }));
  const transport = result.rows.find((row) => row.id === "transport");
  assert.equal(transport.amount, null);
  assert.equal(transport.status, "unpriced");
  assert.ok(result.unpricedCategories.includes("Ground transport"));
});

test("cost estimate accepts ordinary numeric amounts and rejects invalid values", () => {
  assert.equal(parseCostEstimate("$2,500.00"), 2500);
  assert.equal(parseCostEstimate(" 125 "), 125);
  assert.equal(parseCostEstimate(""), null);
  assert.equal(parseCostEstimate("$2.5k"), null);
  assert.equal(parseCostEstimate("-40"), null);
});

test("trip validation preserves destination area, airport, passenger and cabin fields", () => {
  const parsed = parseTripSearch(validSearchParams());
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.input.destination, "Dominican Republic");
  assert.equal(parsed.input.destinationArea, "Las Terrenas");
  assert.equal(parsed.input.destinationAirportCode, "STI");
  assert.equal(parsed.input.adults, 2);
  assert.equal(parsed.input.cabinClass, "economy");
  assert.equal(parsed.input.stops, "nonstop");
});

test("omitted connection preferences stay empty rather than inheriting an earlier trip", () => {
  const parsed = parseTripSearch(validSearchParams());
  assert.deepEqual(parsed.input.preferredLayoverCountries, []);
  assert.deepEqual(parsed.input.avoidLayoverCountries, []);
});

test("room count, adult count and child ages are retained for provider handoff", () => {
  const parsed = validateTripSearchInput({
    origin: "JFK", originAirportCode: "JFK", destination: "Dominican Republic", destinationArea: "Las Terrenas", destinationAirportCode: "STI",
    components: ["stays"], stayTypes: ["vacation_rentals"], staySpaceType: "entire_place", stayMustHaveAmenities: [], stayPreferredAmenities: [],
    departureDate: "2026-12-26", returnDate: "2026-12-28", adults: 2, childrenAges: [6, 12], rooms: 2, budget: 2500, budgetMode: "total",
    currency: "USD", style: "beach", flexible: false, flexibleDays: 0, cabinClass: "economy", stops: "any", preferredLayoverCountries: [], avoidLayoverCountries: [],
    minimumHotelRating: 0, freeCancellation: false, temperatureMin: null, temperatureMax: null, temperatureUnit: "F", planningNotes: [],
  });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.input.rooms, 2);
  assert.deepEqual(parsed.input.childrenAges, [6, 12]);
  assert.equal(parsed.input.staySpaceType, "entire_place");
});

test("invalid chronological date ranges are rejected", () => {
  const parsed = parseTripSearch(validSearchParams({ return: "2026-12-25" }));
  assert.ok(parsed.errors.some((error) => /Return date must be after departure date/i.test(error)));
});


test("blank estimates remain unpriced but explicit zero estimates are recorded as user-entered", () => {
  const blank = buildTripCostLedger(ledgerInput({ flightRequested: false, stayRequested: false, activitiesRequested: true }));
  assert.ok(blank.unpricedCategories.includes("Ground transport"));
  assert.ok(blank.unpricedCategories.includes("Activities"));
  const explicitZero = buildTripCostLedger(ledgerInput({
    flightRequested: false, stayRequested: false, activitiesRequested: true,
    manual: { groundTransport: 0, activities: 0, dining: 0 },
  }));
  assert.equal(explicitZero.unpricedCategories.length, 0);
  assert.equal(explicitZero.rows.find((row) => row.id === "transport").amount, 0);
  assert.equal(explicitZero.rows.find((row) => row.id === "activities").amount, 0);
  assert.equal(explicitZero.rows.find((row) => row.id === "dining").amount, 0);
  assert.equal(explicitZero.budgetEnforcement.ready, true);
});

test("budget enforcement stays advisory when flight or accommodation prices are not verified all-in totals", () => {
  const result = buildTripCostLedger(ledgerInput({
    manual: { groundTransport: 0, activities: 0, dining: 0 },
  }));
  assert.equal(result.budgetEnforcement.ready, false);
  assert.match(result.budgetEnforcement.reasons.join(" "), /airfare.*display quote/i);
  assert.match(result.budgetEnforcement.reasons.join(" "), /Accommodation display totals/i);
});
