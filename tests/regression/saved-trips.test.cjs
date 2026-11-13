const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildSavedTripForkDraft, normalizeSavedTripSnapshot, serializeTripSearchInput, shiftSavedTripSnapshotDateRange, sortSavedTripItemsChronologically, validateSavedTripDraft } = require("../../.test-build/lib/trip-planner/saved-trips.js");

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


test("safe shared-trip fork preserves selected itinerary items and safe re-match references", () => {
  const normalized = normalizeSavedTripSnapshot(snapshot);
  assert.ok(normalized);
  const fork = buildSavedTripForkDraft({ search, snapshot: normalized });
  assert.equal(fork.search, search);
  assert.equal(fork.snapshot.title, "Copy of Trip to Las Terrenas, Dominican Republic");
  assert.deepEqual(fork.snapshot.destinations.map((destination) => destination.label), ["Las Terrenas, Dominican Republic"]);
  assert.deepEqual(fork.snapshot.destinations.map((destination) => destination.items), normalized.destinations.map((destination) => destination.items));
  assert.ok(validateSavedTripDraft(fork).draft);
});

test("changing the copied trip date range shifts schedule days and flags date-bound offers for review", () => {
  const selected = normalizeSavedTripSnapshot({
    ...snapshot,
    destinations: [{ label: "Las Terrenas, Dominican Republic", items: [
      { kind: "outbound-flight", title: "Outbound flight", subtitle: "JetBlue · JFK → STI", date: "2026-12-26", details: [], selectionRef: { type: "flight", direction: "outbound", from: "JFK", to: "STI", departure: "2026-12-26 18:38", arrival: "2026-12-26 23:29", segmentKeys: ["JetBlue|B6123|New York|Santiago|2026-12-26 18:38|2026-12-26 23:29"] } },
      { kind: "return-flight", title: "Return flight", subtitle: "JetBlue · STI → JFK", date: "2026-12-28", details: [], selectionRef: { type: "flight", direction: "return", from: "STI", to: "JFK", departure: "2026-12-28 10:00", arrival: "2026-12-28 14:00", segmentKeys: ["JetBlue|B6124|Santiago|New York|2026-12-28 10:00|2026-12-28 14:00"] } },
      { kind: "stay-check-in", title: "Hotel Example", subtitle: "Las Terrenas", date: "2026-12-26", time: "3:00 PM", details: [], selectionRef: { type: "stay", name: "Hotel Example", address: "Las Terrenas" } },
      { kind: "stay-check-out", title: "Hotel Example", subtitle: "Las Terrenas", date: "2026-12-28", time: "11:00 AM", details: [] },
      { kind: "activity", title: "Playa Punta Popy", subtitle: "Beach", date: "2026-12-27", time: "Morning", details: [], selectionRef: { type: "experience", kind: "activity", name: "Playa Punta Popy", address: "Las Terrenas", category: "Beach", date: "2026-12-27", slot: "Morning" } },
    ] }],
  });
  assert.ok(selected);
  const shifted = shiftSavedTripSnapshotDateRange(selected, "2026-12-26", "2026-12-28", "2027-01-10", "2027-01-12");
  const byKind = Object.fromEntries(shifted.destinations[0].items.map((item) => [item.kind, item]));
  assert.equal(byKind["outbound-flight"].date, "2027-01-10");
  assert.equal(byKind["return-flight"].date, "2027-01-12");
  assert.equal(byKind["outbound-flight"].dateNeedsReview, true);
  assert.equal(byKind["return-flight"].dateNeedsReview, true);
  assert.equal(byKind["stay-check-in"].date, "2027-01-10");
  assert.equal(byKind["stay-check-out"].date, "2027-01-12");
  assert.equal(byKind.activity.date, "2027-01-11");
  assert.equal(byKind.activity.selectionRef.date, "2027-01-11");
  assert.equal(byKind.activity.dateNeedsReview, undefined);
  assert.ok(validateSavedTripDraft({ search: { ...search, departureDate: "2027-01-10", returnDate: "2027-01-12" }, snapshot: shifted }).draft);
});

test("activities shifted outside a shortened trip are flagged instead of silently rescheduled", () => {
  const selected = normalizeSavedTripSnapshot({
    ...snapshot,
    destinations: [{ label: "Las Terrenas", items: [{ kind: "activity", title: "Day three activity", date: "2026-12-28", time: "Afternoon", details: [], selectionRef: { type: "experience", kind: "activity", name: "Day three activity", address: "Las Terrenas", category: "Tour", date: "2026-12-28", slot: "Afternoon" } }] }],
  });
  assert.ok(selected);
  const shifted = shiftSavedTripSnapshotDateRange(selected, "2026-12-26", "2026-12-28", "2027-01-10", "2027-01-11");
  const activity = shifted.destinations[0].items[0];
  assert.equal(activity.date, "2027-01-12");
  assert.equal(activity.selectionRef.date, "2027-01-12");
  assert.equal(activity.dateNeedsReview, true);
  assert.equal(normalizeSavedTripSnapshot(shifted).destinations[0].items[0].dateNeedsReview, true);
});

test("saved itinerary re-match references preserve safe flight, hotel and experience identity without booking tokens", () => {
  const selected = {
    ...snapshot,
    destinations: [{ label: "Las Terrenas, Dominican Republic", items: [
      { kind: "outbound-flight", title: "Outbound flight", subtitle: "JetBlue · JFK → STI", date: "2026-12-26", details: [], selectionRef: { type: "flight", direction: "outbound", from: "JFK", to: "STI", departure: "2026-12-26 18:38", arrival: "2026-12-26 23:29", segmentKeys: ["JetBlue|B6123|New York|Santiago|2026-12-26 18:38|2026-12-26 23:29"] } },
      { kind: "stay-check-in", title: "Hotel Example", subtitle: "Las Terrenas", date: "2026-12-26", details: [], selectionRef: { type: "stay", name: "Hotel Example", address: "Las Terrenas" } },
      { kind: "activity", title: "Playa Punta Popy", subtitle: "Beach", date: "2026-12-27", details: [], selectionRef: { type: "experience", kind: "activity", name: "Playa Punta Popy", address: "Las Terrenas", category: "Beach", date: "2026-12-27", slot: "Morning", time: "10:30" } },
    ] }],
  };
  const normalized = normalizeSavedTripSnapshot(selected);
  assert.ok(normalized);
  assert.equal(normalized.destinations[0].items[0].selectionRef.type, "flight");
  assert.equal(normalized.destinations[0].items[1].selectionRef.type, "stay");
  assert.equal(normalized.destinations[0].items[2].selectionRef.slot, "Morning");
  const fork = buildSavedTripForkDraft({ search, snapshot: normalized });
  assert.deepEqual(fork.snapshot.destinations[0].items, normalized.destinations[0].items);
  assert.doesNotMatch(JSON.stringify(fork.snapshot), /departureToken|bookingToken|propertyToken|postData/);
});

test("older saved trip snapshots derive re-match references from itinerary text where possible", () => {
  const legacy = normalizeSavedTripSnapshot({
    ...snapshot,
    destinations: [{ label: "Las Terrenas", items: [
      { kind: "activity", title: "Playa Punta Popy", subtitle: "Beach", date: "2026-12-27", time: "11:00", details: ["Beach"] },
      { kind: "stay-check-in", title: "Hotel Example", subtitle: "Las Terrenas", date: "2026-12-26", details: ["Check-in · 2 nights"] },
      { kind: "outbound-flight", title: "Outbound flight", subtitle: "JetBlue · JFK → STI", date: "2026-12-26", details: ["Departs New York · 6:38 PM EST", "Arrives Santiago · 11:29 PM AST", "Duration 4h 51m · Nonstop", "Leg 1: JetBlue B6123 · New York 6:38 PM EST → Santiago 11:29 PM AST"] },
    ] }],
  });
  assert.ok(legacy);
  assert.equal(legacy.destinations[0].items[0].selectionRef.type, "experience");
  assert.equal(legacy.destinations[0].items[1].selectionRef.type, "stay");
  assert.equal(legacy.destinations[0].items[2].selectionRef.legacyDisplay, true);
});

test("saved trip selection references reject malformed identities without leaking unsafe content", () => {
  const invalid = normalizeSavedTripSnapshot({ ...snapshot, destinations: [{ label: "x", items: [{ kind: "activity", title: "x", details: [], selectionRef: { type: "flight", direction: "outbound", from: "JFK", to: "STI", departure: "x", arrival: "y", segmentKeys: ["flight"] } }] }] });
  assert.ok(invalid);
  assert.equal(invalid.destinations[0].items[0].selectionRef, undefined);
});

test("shared copies are not persisted in the database before an explicit Save trip action", () => {
  const db = read("lib/db/saved-trips.ts");
  const button = read("components/trips/make-trip-copy-button.tsx");
  assert.doesNotMatch(db, /export async function forkSavedTripFromShareToken/);
  assert.doesNotMatch(button, /fetch\(\"\/api\/trips\/fork\"/);
  assert.match(read("app/api/trips/route.ts"), /saveAnonymousTripDraft/);
  assert.match(button, /tripfinder:saved-trip-fork-restore:v1/);
});

test("legacy fork endpoint no longer creates a saved trip or consumes the daily limit", () => {
  const route = read("app/api/trips/fork/route.ts");
  assert.match(route, /FORK_NOW_LOCAL_DRAFT/);
  assert.match(route, /status: 410/);
  assert.doesNotMatch(route, /forkSavedTripFromShareToken|SAVED_TRIP_DAILY_LIMIT/);
});

test("legacy abandoned copies can only be deleted when source snapshot and owner credentials match and the record was never updated", () => {
  const db = read("lib/db/saved-trips.ts");
  const start = db.indexOf("export async function discardUnmodifiedSavedTripFork");
  const end = db.indexOf("/** Create a feedback-only invitation.", start);
  const discard = db.slice(start, end);
  assert.match(discard, /getSavedTripByShareToken\(sourceShareToken\)/);
  assert.match(discard, /created_at = updated_at/);
  assert.match(discard, /owner_token_hash/);
  assert.match(discard, /snapshot = \$\{JSON\.stringify\(expected\.snapshot\)\}::jsonb/);
  assert.match(discard, /save_count - 1/);
  assert.match(read("app/api/trips/fork/discard/route.ts"), /discardUnmodifiedSavedTripFork/);
});

test("shared page offers a copy action while the original public share remains read-only", () => {
  const page = read("app/trip/[token]/page.tsx");
  const button = read("components/trips/make-trip-copy-button.tsx");
  assert.match(page, /MakeTripCopyButton/);
  assert.match(page, /Reopening this original link remains read-only/);
  assert.match(page, /snapshot=\{saved\.snapshot\}/);
  assert.match(page, /carries over your selected itinerary/);
  assert.doesNotMatch(button, /fetch\(\"\/api\/trips\/fork\"/);
  assert.match(button, /tripfinder:saved-trip-owner:v1:/);
  assert.match(button, /tripfinder:saved-trip-fork-restore:v1/);
  assert.match(button, /tripfinder:pending-shared-copy:v1:/);
  assert.match(button, /copyId/);
  assert.match(button, /window\.location\.assign\(returnPath\)/);
  assert.match(button, /\/api\/trips\/fork\/discard/);
  assert.match(button, /It only uses a daily saved-trip slot when you press Save trip/);
  assert.doesNotMatch(button, /ownerToken.*searchParams|searchParams.*ownerToken/);
});

test("copied trip stays an unsaved local draft until Save trip is explicitly pressed", () => {
  const button = read("components/trips/make-trip-copy-button.tsx");
  const ui = read("components/trips/results-workspace.tsx");
  assert.match(button, /localStorage\.setItem\(restoreStorageKey/);
  assert.match(button, /tripfinder:pending-shared-copy-session:v1:/);
  assert.match(ui, /This is an unsaved draft/);
  assert.match(ui, /closing this page before saving will not use a daily saved-trip slot/);
  assert.match(ui, /clearPendingSharedCopySession\(\)/);
  assert.match(ui, /restoringCopiedTrip/);
  assert.match(ui, /Restoring selections/);
  assert.match(ui, /const payload: Record<string, unknown> = \{ search, snapshot \}/);
});


test("copied trip restores current matching flights, stays and scheduled experiences when live results load", () => {
  const ui = read("components/trips/results-workspace.tsx");
  assert.match(ui, /tripfinder:saved-trip-fork-restore:v1/);
  assert.match(ui, /flightMatchesRestoreReference/);
  assert.match(ui, /selectionRef/);
  assert.match(ui, /returnFlight: match/);
  assert.match(ui, /The original return flight is no longer an exact current match/);
  assert.match(ui, /saved seller offer was rechecked and restored/);
});

test("shared link action controls use a non-overlapping responsive grid", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /\.saved-trip-actions \{ display: grid/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.saved-trip-actions \.saved-trip-copy-button/);
});

test("frozen Your Trip overview offers validated editable dates and migrates saved-trip restore state", () => {
  const ui = read("components/trips/results-workspace.tsx");
  assert.match(ui, /results-overview-change-dates/);
  assert.match(ui, /type="date" value=\{nextDepartureDate\}/);
  assert.match(ui, /type="date" value=\{nextReturnDate\}/);
  assert.match(ui, /tripfinder:saved-trip-owner:v1:/);
  assert.match(ui, /tripfinder:saved-trip-fork-restore:v1:/);
  assert.match(ui, /shiftSavedTripSnapshotDateRange/);
  assert.match(ui, /window\.location\.assign/);
});

test("Release 5 roadmap tracks itinerary-copy restoration and editable trip dates", () => {
  const roadmap = read("docs/PRODUCT-ROADMAP.md");
  assert.match(roadmap, /\[x\] Add a safe "Make my own copy"[\s\S]*preserves selected flights, stays, activities, restaurants/);
  assert.match(roadmap, /\[x\] Allow travelers to change departure\/check-in and return\/check-out dates from the frozen "Your Trip" overview/);
  assert.doesNotMatch(roadmap, /Provider-backed selections are deliberately cleared/);
});

test("date range editor snapshots the live selections when there is no pending fork-restore payload", () => {
  const ui = read("components/trips/results-workspace.tsx");
  assert.match(ui, /currentSnapshot\.destinations\.some\(\(destination\) => destination\.items\.length > 0\)/);
  assert.match(ui, /currentSnapshot=\{buildSavedTripSnapshot\(search, recommendations, states, selections\)\}/);
  assert.match(ui, /window\.localStorage\.setItem\(`\$\{restorePrefix\}\$\{nextIdentity\}`/);
});

test("date-bound flight and out-of-window activity selections are withheld from automatic restoration", () => {
  const ui = read("components/trips/results-workspace.tsx");
  const page = read("app/trip/[token]/page.tsx");
  assert.match(ui, /const reviewItems = items\.filter\(\(item\) => item\.dateNeedsReview\)/);
  assert.match(ui, /const selectableItems = items\.filter\(\(item\) => !item\.dateNeedsReview\)/);
  assert.match(page, /item\.dateNeedsReview && <p className="saved-trip-date-review">/);
});
