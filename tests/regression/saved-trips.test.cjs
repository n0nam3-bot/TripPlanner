const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeSavedTripSnapshot, serializeTripSearchInput, sortSavedTripItemsChronologically, validateSavedTripDraft } = require("../../.test-build/lib/trip-planner/saved-trips.js");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const search = {
  origin: "New York (NYC)", originAirportCode: "NYC", destination: "Dominican Republic", destinationArea: "Las Terrenas", destinationAirportCode: "STI",
  components: ["flights", "stays", "activities"], stayTypes: ["vacation_rentals"], staySpaceType: "entire_place", stayMustHaveAmenities: ["beach_access"], stayPreferredAmenities: [],
  departureDate: "2026-12-26", returnDate: "2026-12-28", adults: 2, childrenAges: [], rooms: 1, budget: 2500, budgetMode: "total", currency: "USD", style: "beach", flexible: false, flexibleDays: 0,
  cabinClass: "economy", stops: "nonstop", preferredLayoverCountries: [], avoidLayoverCountries: [], minimumHotelRating: 0, freeCancellation: false, temperatureMin: null, temperatureMax: null, temperatureUnit: "F", planningNotes: ["Restaurant proximity: target within 5 minutes"],
};

const snapshot = {
  version: 1,
  title: "Trip to Las Terrenas, Dominican Republic",
  destinations: [{ label: "Las Terrenas, Dominican Republic", items: [
    { kind: "outbound-flight", title: "Outbound flight", subtitle: "JetBlue · JFK → STI", date: "2026-12-26", price: 430, currency: "USD", priceLabel: "Reference only", details: ["Departs JFK · 6:38 PM EST", "Arrives STI · 11:29 PM AST"] },
    { kind: "activity", title: "Playa Punta Popy", subtitle: "Las Terrenas", date: "2026-12-27", time: "11:00", details: ["Beach"] },
  ] }],
};

test("saved trip search serialization preserves dates, area, travelers and preferences", () => {
  const query = new URLSearchParams(serializeTripSearchInput(search));
  assert.equal(query.get("destinationArea"), "Las Terrenas");
  assert.equal(query.get("depart"), "2026-12-26");
  assert.equal(query.get("return"), "2026-12-28");
  assert.equal(query.get("adults"), "2");
  assert.equal(query.get("avoidLayovers"), "");
  assert.equal(query.get("stops"), "nonstop");
  assert.equal(query.get("stayMust"), "beach_access");
});

test("saved trip snapshot allowlists item types and normalizes text", () => {
  const result = normalizeSavedTripSnapshot({ ...snapshot, title: "  Trip\n to Las Terrenas  " });
  assert.ok(result);
  assert.equal(result.title, "Trip to Las Terrenas");
  assert.equal(result.destinations[0].items.length, 2);
});

test("saved trip rejects unsupported item kinds, invalid dates and over-sized selections", () => {
  assert.equal(normalizeSavedTripSnapshot({ ...snapshot, destinations: [{ label: "x", items: [{ kind: "booking-token", title: "secret", details: [] }] }] }), null);
  assert.equal(normalizeSavedTripSnapshot({ ...snapshot, destinations: [{ label: "x", items: [{ kind: "activity", title: "x", date: "2026-02-31", details: [] }] }] }), null);
  assert.equal(normalizeSavedTripSnapshot({ ...snapshot, destinations: [{ label: "x", items: Array.from({ length: 51 }, () => ({ kind: "activity", title: "x", details: [] })) }] }), null);
});


test("saved trip items use the live itinerary's chronological event timestamps", () => {
  const items = [
    { kind: "return-flight", title: "Return flight", date: "2026-12-28", sortTimestamp: Date.parse("2026-12-28T07:44:00Z"), details: [] },
    { kind: "restaurant", title: "Day 2 lunch", date: "2026-12-27", time: "Lunch", sortTimestamp: Date.parse("2026-12-27T15:00:00Z"), details: [] },
    { kind: "stay-check-out", title: "Property checkout", date: "2026-12-28", sortTimestamp: Date.parse("2026-12-28T07:43:00Z"), details: [] },
    { kind: "stay-check-in", title: "Property check-in", date: "2026-12-26", sortTimestamp: Date.parse("2026-12-27T04:29:00Z"), details: [] },
    { kind: "outbound-flight", title: "Outbound flight", date: "2026-12-26", sortTimestamp: Date.parse("2026-12-27T00:38:00Z"), details: [] },
    { kind: "activity", title: "Morning activity", date: "2026-12-26", time: "Morning", sortTimestamp: Date.parse("2026-12-26T13:00:00Z"), details: [] },
  ];
  assert.deepEqual(sortSavedTripItemsChronologically(items).map((item) => item.title), [
    "Morning activity", "Outbound flight", "Property check-in", "Day 2 lunch", "Property checkout", "Return flight",
  ]);
});

test("legacy saved trips without timestamps receive stable date and slot-based ordering", () => {
  const legacy = [
    { kind: "return-flight", title: "Return", date: "2026-12-28", details: [] },
    { kind: "restaurant", title: "Dinner", date: "2026-12-27", time: "Dinner", details: [] },
    { kind: "activity", title: "Morning", date: "2026-12-27", time: "Morning", details: [] },
    { kind: "outbound-flight", title: "Outbound", date: "2026-12-26", details: [] },
  ];
  assert.deepEqual(sortSavedTripItemsChronologically(legacy).map((item) => item.title), ["Outbound", "Morning", "Dinner", "Return"]);
});

test("saved trip draft validates search and rejects arbitrary provider data", () => {
  assert.ok(validateSavedTripDraft({ search, snapshot }).draft);
  assert.equal(validateSavedTripDraft({ search: { ...search, adults: 99 }, snapshot }).draft, undefined);
  assert.equal(validateSavedTripDraft({ search, snapshot: { ...snapshot, destinations: [] } }).draft, undefined);
});

test("server stores hashed share and owner tokens, never raw bearer tokens", () => {
  const source = read("lib/db/saved-trips.ts");
  assert.match(source, /share_token_hash text NOT NULL UNIQUE/);
  assert.match(source, /owner_token_hash text NOT NULL/);
  assert.match(source, /tokenHash\(options\.shareToken, "share"\)/);
  assert.match(source, /tokenHash\(options\.ownerToken, "owner"\)/);
  assert.match(source, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(source, /expires_at > now\(\)/);
});

test("saved trip creation is rate-limited and share page is non-indexed", () => {
  const db = read("lib/db/saved-trips.ts");
  const api = read("app/api/trips/route.ts");
  const page = read("app/trip/[token]/page.tsx");
  assert.match(db, /SAVE_LIMIT_PER_CLIENT_PER_UTC_DAY = 5/);
  assert.match(db, /WHERE tripfinder_saved_trip_daily_usage\.save_count < \$\{SAVE_LIMIT_PER_CLIENT_PER_UTC_DAY\}/);
  assert.match(page, /index: false, follow: false/);
  assert.match(page, /Booking tokens, account credentials and private API data are not included/);
  assert.match(api, /SAVED_TRIP_DAILY_LIMIT/);
});

test("results workspace exposes save/share action and snapshots no booking tokens", () => {
  const ui = read("components/trips/results-workspace.tsx");
  assert.match(ui, /Save trip/);
  assert.match(ui, /Update saved trip/);
  assert.match(ui, /buildSavedTripSnapshot/);
  assert.match(ui, /navigator\.clipboard\.writeText\(data\.shareUrl\)/);
  assert.match(ui, /results-trip-overview-save-actions/);
  assert.match(ui, /onCopyShareLink/);
  assert.match(ui, /Open link/);
  assert.doesNotMatch(ui.slice(ui.indexOf("function buildSavedTripSnapshot"), ui.indexOf("function nearestKnownAirport")), /bookingToken|departureToken|propertyToken|postData/);
});

test("public saved-trip page uses the same chronological sorter and renders stay milestones", () => {
  const page = read("app/trip/[token]/page.tsx");
  assert.match(page, /sortSavedTripItemsChronologically\(group\.items\)/);
  assert.match(page, /stay-check-in/);
  assert.match(page, /stay-check-out/);
  const source = read("components/trips/results-workspace.tsx");
  assert.match(source, /sortSavedTripItemsChronologically\(items\)/);
  assert.match(source, /sortTimestamp: checkInSortAt/);
  assert.match(source, /sortTimestamp: checkOutSortAt/);
});

test("Neon health and schema include anonymous saved-trip tables", () => {
  const cache = read("lib/db/travel-cache.ts");
  const schema = read("db/schema.sql");
  const health = read("app/api/health/route.ts");
  for (const table of ["tripfinder_saved_trips", "tripfinder_saved_trip_daily_usage"]) {
    assert.ok(cache.includes(table));
    assert.ok(schema.includes(table));
    assert.ok(health.includes(table));
  }
});
