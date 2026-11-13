const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const { makeFlexibleFlightCalendarParams, normalizeFlexibleFlightDateOptions, tripDurationDays } = require("../../.test-build/lib/trip-planner/flexible-flight-dates.js");
const { formatTripDestinationLabel } = require("../../.test-build/lib/trip-planner/destinations.js");

function baseInput(overrides = {}) {
  return {
    origin: "New York (NYC)", originAirportCode: "NYC", destination: "Albania", destinationArea: "", destinationAirportCode: "TIA",
    components: ["flights"], stayTypes: ["hotels", "vacation_rentals"], staySpaceType: "any", stayMustHaveAmenities: [], stayPreferredAmenities: [],
    departureDate: "2027-06-26", returnDate: "2027-07-09", adults: 2, childrenAges: [], rooms: 1, budget: 4000, budgetMode: "total",
    currency: "USD", style: "any", flexible: true, flexibleDays: 2, cabinClass: "premium_economy", stops: "nonstop",
    preferredLayoverCountries: ["Germany"], avoidLayoverCountries: ["Serbia"], minimumHotelRating: 0, freeCancellation: false,
    temperatureMin: null, temperatureMax: null, temperatureUnit: "F", planningNotes: [],
    ...overrides,
  };
}

test("flexible calendar search uses one bounded round-trip date window and preserves trip duration", () => {
  const params = makeFlexibleFlightCalendarParams(baseInput(), "NYC", "TIA", "2027-06-20");
  assert.equal(params.engine, "google_flights_calendar");
  assert.equal(params.departure_id, "JFK,EWR,LGA");
  assert.equal(params.arrival_id, "TIA");
  assert.equal(params.date_range_start, "2027-06-24");
  assert.equal(params.date_range_end, "2027-06-28");
  assert.equal(params.round_trip_days, "13");
  assert.equal(params.fixed_outbound_date, "false");
  assert.equal(params.travel_class, "2");
  assert.equal(params.adults, "2");
  assert.equal(params.type, "1");
  assert.equal(params.stops, undefined, "calendar prices do not expose exact itinerary stop filters");
  assert.equal(params.avoid_layover_country, undefined, "calendar prices do not expose airport stop-country filters");
});

test("flexible calendar window clips dates before today and rejects unsupported windows", () => {
  const clipped = makeFlexibleFlightCalendarParams(baseInput({ departureDate: "2027-01-02", returnDate: "2027-01-15", flexibleDays: 3 }), "JFK", "TIA", "2027-01-01");
  assert.equal(clipped.date_range_start, "2027-01-01");
  assert.equal(clipped.date_range_end, "2027-01-05");
  assert.throws(() => makeFlexibleFlightCalendarParams(baseInput({ flexibleDays: 4 }), "JFK", "TIA", "2027-01-01"), /INVALID_FLEXIBLE_DATE_WINDOW/);
  assert.throws(() => makeFlexibleFlightCalendarParams(baseInput(), "JFK", "TIRANA", "2027-01-01"), /DESTINATION_AIRPORT_UNRESOLVED/);
});

test("calendar response keeps valid date pairs, removes out-of-window rows and sorts by price-independent date", () => {
  const normalized = normalizeFlexibleFlightDateOptions([
    { outbound_date: "2027-06-27", return_date: "2027-07-10", price: 880, low_price: true },
    { outbound_date: "2027-06-24", return_date: "2027-07-07", price: "920" },
    { outbound_date: "2027-06-29", return_date: "2027-07-12", price: 830 },
    { outbound_date: "2027-06-25", return_date: "2027-07-25", price: 750 },
    { outbound_date: "bad-date", return_date: "2027-07-08", price: 700 },
    { outbound_date: "2027-06-26", return_date: "2027-07-09", price: -1 },
  ], "USD", "2027-06-24", "2027-06-28");
  assert.deepEqual(normalized.map((item) => item.departureDate), ["2027-06-24", "2027-06-25", "2027-06-27"]);
  assert.equal(normalized[0].currency, "USD");
  assert.equal(normalized[2].lowPrice, true);
  assert.equal(tripDurationDays("2027-06-26", "2027-07-09"), 13);
});

test("results quick navigation includes the requested sections and each item has separate jump and disclosure controls", () => {
  const source = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");
  for (const label of ["Flights", "Places to stay", "Activities & attractions", "Restaurants & dining", "Weather", "Your plan", "Cost breakdown", "Your trip schedule"]) {
    assert.ok(source.includes(`label: "${label}"`) || source.includes(`<strong>${label}</strong>`), `missing section ${label}`);
  }
  assert.match(source, /aria-label="Trip section navigation"/);
  assert.match(source, /className="results-section-rail-link"/);
  assert.match(source, /className="results-section-rail-toggle"/);
  assert.match(source, /aria-expanded=\{isOpen\}/);
  assert.match(source, /openState\[section\.id\]/);
  assert.match(source, /const sectionId = event\.currentTarget\.id/);
  assert.match(source, /target\.scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("results navigation has a fixed desktop rail and a compact mobile horizontal layout", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/results/page.tsx"), "utf8");
  assert.match(css, /\.results-section-rail\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /@media\s*\(max-width:\s*1279px\)\s*\{[^}]*\.results-section-rail\s*\{\s*position:\s*sticky/s);
  assert.match(css, /\.results-section-rail-list\s*\{\s*display:\s*flex;\s*gap:\s*5px;\s*overflow-x:\s*auto/s);
  assert.match(page, /results-content shell results-content-with-rail/);
});


test("results workspace imports flexible date types from their defining modules", () => {
  const source = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");
  assert.match(source, /import type \{ FlexibleFlightDateSearchResult \} from "@\/lib\/providers\/serpapi";/);
  assert.match(source, /import type \{ FlexibleFlightDateOption \} from "@\/lib\/trip-planner\/flexible-flight-dates";/);
  assert.doesNotMatch(source, /import type \{\s*FlexibleFlightDateOption\s*,\s*FlexibleFlightDateSearchResult\s*\} from "@\/lib\/providers\/serpapi";/);
});


test("product roadmap uses visible checkmarks for completed work and unchecked boxes for open work", () => {
  const roadmap = fs.readFileSync(path.join(root, "docs/PRODUCT-ROADMAP.md"), "utf8");
  const roadmapItems = roadmap.split(/\r?\n/).filter((line) => line.startsWith("- "));
  assert.ok(roadmapItems.length > 30, "roadmap checklist should cover all listed milestones");
  assert.ok(roadmapItems.every((line) => line.startsWith("- [x] ") || line.startsWith("- [ ] ")), "every roadmap item must have an explicit status checkbox");
  const release0 = roadmap.split("## Release 0")[1].split("## Release 1")[0];
  const release1 = roadmap.split("## Release 1")[1].split("## Release 2")[0];
  const release2 = roadmap.split("## Release 2 —")[1].split("## Release 2.5")[0];
  const release25 = roadmap.split("## Release 2.5")[1].split("## Release 3")[0];
  const release3 = roadmap.split("## Release 3")[1].split("## Release 4")[0];
  for (const section of [release0, release1, release2, release25, release3]) {
    assert.match(section, /- \[x\] /, "completed release sections must show checkmarks");
    assert.doesNotMatch(section, /- \[ \] /, "fully implemented releases must not show open tasks");
  }
  assert.match(roadmap, /## Release 4[\s\S]*?- \[ \] Enforce hard budget constraints/);
  assert.match(roadmap, /## Release 5[\s\S]*?- \[ \] Neon persistence/);
  assert.match(roadmap, /## Release 6[\s\S]*?- \[x\] Initial Booking\.com/);
});


test("results layout places the compact search snapshot above the fixed section navigation", () => {
  const source = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");
  const assistant = fs.readFileSync(path.join(root, "components/trips/ai-trip-assistant.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(source, /className="results-left-sidebar"[\s\S]*?ResultsTripOverview[\s\S]*?ResultsSectionNavigation/);
  assert.match(source, /className="results-trip-overview"/);
  assert.match(assistant, /const \[open, setOpen\] = useState\(true\)/);
  assert.match(assistant, /is-expanded.*is-minimized/);
  assert.match(css, /\.trip-ai-dock\.is-expanded\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /\.results-content-with-rail:has\(\.trip-ai-dock\.is-expanded\)/);
  assert.match(css, /\.results-content-with-rail:has\(\.trip-ai-dock\.is-minimized\)/);
  assert.match(css, /@media \(max-width: 1279px\)/);
});

test("trip heading destination formatter avoids repeating the area already present in the destination", () => {
  assert.equal(formatTripDestinationLabel("Las Terrenas, Dominican Republic", "Las Terrenas"), "Las Terrenas, Dominican Republic");
  assert.equal(formatTripDestinationLabel("Dominican Republic", "Las Terrenas"), "Las Terrenas, Dominican Republic");
  assert.equal(formatTripDestinationLabel("Albania", ""), "Albania");
});
