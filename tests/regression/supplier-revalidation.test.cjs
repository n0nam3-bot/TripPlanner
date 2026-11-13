const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("flight seller-token and property-token lookups have short freshness windows", () => {
  const source = read("lib/providers/serpapi.ts");
  assert.match(source, /params\.booking_token\) return \{ ttlSeconds: 5 \* 60, staleMaxAgeSeconds: 6 \* 3600 \}/);
  assert.match(source, /params\.property_token\) return \{ ttlSeconds: 10 \* 60, staleMaxAgeSeconds: 12 \* 3600 \}/);
});

test("explicit supplier rechecks bypass the Tripfinder provider cache", () => {
  const provider = read("lib/providers/serpapi.ts");
  const flightStart = provider.indexOf("export async function getFlightBookingOptions(");
  const hotelStart = provider.indexOf("export async function getHotelBookingOptions(");
  const hotelEnd = provider.indexOf("export type DrivingRouteResult", hotelStart);
  const flightFn = provider.slice(flightStart);
  const hotelFn = provider.slice(hotelStart, hotelEnd);
  assert.match(flightFn, /forceRefresh = false/);
  assert.match(flightFn, /querySerpApi\(params, clientUsageKey, forceRefresh\)/);
  assert.match(hotelFn, /forceRefresh = false/);
  assert.match(hotelFn, /querySerpApi\(params, clientUsageKey, forceRefresh\)/);
  const flightRoute = read("app/api/travel/booking-options/route.ts");
  const hotelRoute = read("app/api/travel/hotel-options/route.ts");
  assert.match(flightRoute, /body\.forceRefresh === true/);
  assert.match(hotelRoute, /body\.forceRefresh === true/);
});

test("supplier lookups return checked time, provider-data time, cache and stale metadata", () => {
  const provider = read("lib/providers/serpapi.ts");
  for (const field of ["checkedAt", "dataAsOf", "servedFromCache", "stale"]) {
    assert.match(provider, new RegExp(`${field}:`));
  }
  const flightRoute = read("app/api/travel/booking-options/route.ts");
  const hotelRoute = read("app/api/travel/hotel-options/route.ts");
  for (const field of ["checkedAt", "dataAsOf", "servedFromCache", "stale"]) {
    assert.ok(flightRoute.includes(field), `flight endpoint missing ${field}`);
    assert.ok(hotelRoute.includes(field), `hotel endpoint missing ${field}`);
  }
});

test("results UI exposes deliberate seller-rate rechecks and honest freshness notices", () => {
  const source = read("components/trips/results-workspace.tsx");
  assert.match(source, /Recheck seller prices/);
  assert.match(source, /Recheck current rates/);
  assert.match(source, /forceRefresh \}\)/);
  assert.match(source, /supplierFreshnessLabel\(state\)/);
  assert.match(source, /Rates are not a booking hold/);
  assert.match(source, /Seller prices are snapshots, not a booking hold/);
});

test("hotel rate cards preserve total-stay versus nightly versus unknown price basis", () => {
  const provider = read("lib/providers/serpapi.ts");
  const ui = read("components/trips/results-workspace.tsx");
  assert.match(provider, /priceBasis: HotelBookingOption\["priceBasis"\]/);
  assert.match(provider, /stayPrice !== null \? "stay" : nightPrice !== null \? "night" : "unknown"/);
  assert.match(ui, /option\.priceBasis === "stay" \? " · total stay" : option\.priceBasis === "night" \? " · per night" : " · basis not supplied"/);
});

test("roadmap records completed on-demand revalidation while keeping availability guarantees open", () => {
  const roadmap = read("docs/PRODUCT-ROADMAP.md");
  assert.match(roadmap, /- \[x\] Add user-triggered supplier-offer revalidation/);
  assert.match(roadmap, /- \[ \] Verify supplier-declared inventory\/availability/);
});

test("a refreshed flight seller quote cannot silently survive when that exact offer disappeared or changed", () => {
  const source = read("components/trips/results-workspace.tsx");
  assert.match(source, /const matchingOffer = refreshedOptions\.find\(\(offer\) => bookingOptionKey\(offer\) === bookingOptionKey\(selection\.flightSeller!\.option\)\)/);
  assert.match(source, /flightSeller: null/);
});
