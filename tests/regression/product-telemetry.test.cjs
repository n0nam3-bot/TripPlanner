const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("telemetry endpoint accepts only bounded, allowlisted event metadata", () => {
  const api = read("app/api/telemetry/route.ts");
  assert.match(api, /rawBody\.length > 2048/);
  assert.match(api, /eventType === "outbound_click"/);
  assert.match(api, /eventType === "result_selected"/);
  assert.match(api, /"tripfinder"/);
  assert.match(api, /google_flights/);
  assert.match(api, /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-4/);
  assert.doesNotMatch(api, /input\.(url|href|searchText|destination|bookingToken)/);
});

test("journey IDs are hashed and numeric result counts are the only search payload stored", () => {
  const db = read("lib/db/travel-cache.ts");
  assert.match(db, /createHash\("sha256"\)\.update\("tripfinder-journey-v1:"\)/);
  assert.match(db, /result_counts jsonb/);
  assert.match(db, /Math\.min\(500/);
  assert.match(db, /AS searches_started/);
  assert.match(db, /AS searches_with_results/);
  assert.match(db, /AS searches_empty/);
  assert.match(db, /AS searches_failed/);
  assert.match(db, /AS outbound_clicks/);
  assert.match(db, /AS flight_redirect_successes/);
});

test("search, selection, save and seller redirect share one journey ID without recording raw URLs", () => {
  const workspace = read("components/trips/results-workspace.tsx");
  const search = read("app/api/travel/search/route.ts");
  const trips = read("app/api/trips/route.ts");
  const redirect = read("app/api/travel/flight-booking-redirect/route.ts");
  assert.match(workspace, /journeyIdRef/);
  assert.match(workspace, /sendProductEvent\("outbound_click"/);
  assert.match(workspace, /sendProductEvent\("result_selected"/);
  assert.match(workspace, /journeyId: getJourneyId\(\)/);
  assert.match(search, /eventType: "trip_search_started"/);
  assert.match(search, /eventType: "trip_search_completed"/);
  assert.match(search, /eventType: "trip_search_failed"/);
  assert.match(trips, /eventType: shareToken \? "trip_updated" : "trip_saved"/);
  assert.match(redirect, /eventType: "outbound_redirect"/);
  assert.match(redirect, /journeyId/);
  assert.doesNotMatch(redirect, /recordProviderEvent\(\{[^}]*finalUrl/s);
});

test("admin dashboard distinguishes provider API health from product funnel and outbound clicks", () => {
  const db = read("lib/db/travel-cache.ts");
  const ui = read("app/admin/admin-dashboard.tsx");
  assert.match(db, /event_type IN \('provider_request','provider_error','cache_hit','provider_fallback'\)/);
  assert.match(ui, /TRIP SEARCH FUNNEL · LAST 7 DAYS/);
  assert.match(ui, /OUTBOUND LINK HEALTH · LAST 7 DAYS/);
  assert.match(ui, /Click events, not uptime probes/);
  assert.match(ui, /cannot verify that an external provider page loaded or that a booking completed/);
});
