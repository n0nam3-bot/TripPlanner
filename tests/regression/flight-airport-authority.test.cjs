const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resolveAuthoritativeArrivalAirportCode } = require("../../.test-build/lib/trip-planner/flight-search-params.js");
const root = path.join(__dirname, "../..");

test("an explicit arrival airport in confirmed search data outranks mismatched request and recommendation values", () => {
  assert.equal(resolveAuthoritativeArrivalAirportCode("sti", "PUJ", "SDQ"), "STI");
});

test("initial, return, seller and flexible-date endpoints all resolve the airport from confirmed search first", () => {
  for (const rel of [
    "app/api/travel/search/route.ts",
    "app/api/travel/return-flights/route.ts",
    "app/api/travel/booking-options/route.ts",
    "app/api/travel/flexible-dates/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(source, /resolveAuthoritativeArrivalAirportCode\(/, `${rel} should use the shared airport precedence rule`);
    assert.match(source, /validated\.input\.destinationAirportCode/, `${rel} should read the confirmed search object first`);
  }
});

test("live provider search uses the authoritative airport argument instead of a recommendation default", () => {
  const source = fs.readFileSync(path.join(root, "lib/providers/serpapi.ts"), "utf8");
  assert.match(source, /const destinationCode = destinationAirportCode \|\| input\.destinationAirportCode/);
});
