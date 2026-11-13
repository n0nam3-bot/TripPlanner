const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildSavedTripForkDraft, normalizeSavedTripSnapshot, serializeTripSearchInput, sortSavedTripItemsChronologically, validateSavedTripDraft } = require("../../.test-build/lib/trip-planner/saved-trips.js");

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

test("saved trip share metadata preserves approved HTTPS photos, ratings and provider links only", () => {
  const enriched = normalizeSavedTripSnapshot({ ...snapshot, destinations: [{ label: "Las Terrenas", items: [{
    kind: "activity", title: "Playa Punta Popy", subtitle: "Beach", details: [],
    imageUrl: "https://lh3.googleusercontent.com/place-photo.jpg", rating: 4.7, reviewCount: 4118,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Playa%20Punta%20Popy",
    websiteUrl: "https://example.org/official", websiteLabel: "Official website", sourceLabel: "Google Maps",
  }, { kind: "activity", title: "Unsafe metadata", details: [], imageUrl: "https://evil.example/tracker.svg", websiteUrl: "javascript:alert(1)", mapsUrl: "http://127.0.0.1/admin", rating: 7, reviewCount: -1 }] }] });
  assert.ok(enriched);
  const [place, unsafe] = enriched.destinations[0].items;
  assert.equal(place.imageUrl, "https://lh3.googleusercontent.com/place-photo.jpg");
  assert.equal(place.rating, 4.7);
  assert.equal(place.reviewCount, 4118);
  assert.equal(place.websiteUrl, "https://example.org/official");
  assert.equal(place.websiteLabel, "Official website");
  assert.equal(unsafe.imageUrl, undefined);
  assert.equal(unsafe.websiteUrl, undefined);
  assert.equal(unsafe.mapsUrl, undefined);
  assert.equal(unsafe.rating, undefined);
  assert.equal(unsafe.reviewCount, undefined);
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

test("saved flight fare is displayed once for the round trip rather than on each flight leg", () => {
  const source = read("components/trips/results-workspace.tsx");
  const builder = source.slice(source.indexOf("function buildSavedTripSnapshot"), source.indexOf("function nearestKnownAirport"));
  const addFlight = builder.slice(builder.indexOf("const addFlight"), builder.indexOf("if (selection.outbound"));
  assert.doesNotMatch(addFlight, /price:\s*flight\.price/);
  assert.match(builder, /One round-trip search reference/);
  assert.match(builder, /kind:\s*"flight-fare"/);
  assert.match(builder, /Do not add it again to the outbound or return flight/);
});

test("public saved-trip page shows provider photos, review summaries, outbound links and print controls", () => {
  const page = read("app/trip/[token]/page.tsx");
  const styles = read("app/globals.css");
  assert.match(page, /item\.imageUrl/);
  assert.match(page, /item\.rating/);
  assert.match(page, /item\.reviewCount/);
  assert.match(page, /item\.mapsUrl/);
  assert.match(page, /item\.websiteUrl/);
  assert.match(page, /PrintTripButton/);
  assert.match(styles, /@media print/);
  assert.match(styles, /saved-trip-item-image/);
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


test("safe shared-trip fork preserves validated search criteria but clears unverified provider selections", () => {
  const normalized = normalizeSavedTripSnapshot(snapshot);
  assert.ok(normalized);
  const fork = buildSavedTripForkDraft({ search, snapshot: normalized });
  assert.equal(fork.search, search);
  assert.equal(fork.snapshot.title, "Copy of Trip to Las Terrenas, Dominican Republic");
  assert.deepEqual(fork.snapshot.destinations.map((destination) => destination.label), ["Las Terrenas, Dominican Republic"]);
  assert.deepEqual(fork.snapshot.destinations.map((destination) => destination.items), [[]]);
  assert.ok(validateSavedTripDraft(fork).draft);
});

test("database fork reads a public source and creates a new record without owner-update credentials", () => {
  const db = read("lib/db/saved-trips.ts");
  const fork = db.slice(db.indexOf("export async function forkSavedTripFromShareToken"));
  assert.match(fork, /getSavedTripByShareToken\(sourceShareToken\)/);
  assert.match(fork, /buildSavedTripForkDraft/);
  assert.match(fork, /return saveAnonymousTripDraft\(draft, options\)/);
  assert.doesNotMatch(fork, /shareToken:\s*sourceShareToken|ownerToken:/);
});

test("shared-trip fork endpoint validates a source token and returns independent credentials", () => {
  const route = read("app/api/trips/fork/route.ts");
  assert.match(route, /sourceShareToken/);
  assert.match(route, /A-Za-z0-9_-/);
  assert.match(route, /forkSavedTripFromShareToken/);
  assert.match(route, /status: 201/);
  assert.match(route, /ownerToken: saved\.ownerToken/);
  assert.match(route, /SAVED_TRIP_DAILY_LIMIT/);
  assert.match(route, /SAVED_TRIP_SOURCE_NOT_FOUND/);
});

test("shared page offers a copy action while the original public share remains read-only", () => {
  const page = read("app/trip/[token]/page.tsx");
  const button = read("components/trips/make-trip-copy-button.tsx");
  assert.match(page, /MakeTripCopyButton/);
  assert.match(page, /Reopening this original link remains read-only/);
  assert.match(button, /fetch\(\"\/api\/trips\/fork\"/);
  assert.match(button, /tripfinder:saved-trip-owner:v1:/);
  assert.match(button, /localStorage\.setItem/);
  assert.match(button, /window\.location\.assign\(returnPath\)/);
  assert.doesNotMatch(button, /ownerToken.*searchParams|searchParams.*ownerToken/);
});
