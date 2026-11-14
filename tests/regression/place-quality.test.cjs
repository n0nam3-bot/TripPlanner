const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  isRestaurantCategory,
  isUsefulActivityCategory,
  localPlaceDedupeKey,
  sortByStraightLineProximity,
} = require("../../.test-build/lib/trip-planner/place-quality.js");
const { normalizeGeoapifyPlaces } = require("../../.test-build/lib/trip-planner/geoapify-format.js");

test("restaurant category normalization accepts prepared-food businesses and rejects mixed map features", () => {
  assert.equal(isRestaurantCategory("catering · fast_food"), true);
  assert.equal(isRestaurantCategory("catering.restaurant"), true);
  assert.equal(isRestaurantCategory("Cafe / coffee shop"), true);
  assert.equal(isRestaurantCategory("building / catering · restaurant"), false);
  assert.equal(isRestaurantCategory("street / restaurant"), false);
  assert.equal(isRestaurantCategory("building"), false);
  assert.equal(isRestaurantCategory("catering"), false);
});

test("activity category filtering excludes address and infrastructure records", () => {
  assert.equal(isUsefulActivityCategory("tourism · attraction"), true);
  assert.equal(isUsefulActivityCategory("leisure · park"), true);
  assert.equal(isUsefulActivityCategory("building / tourism · attraction"), false);
  assert.equal(isUsefulActivityCategory("highway / attraction"), false);
  assert.equal(isUsefulActivityCategory(""), false);
});

test("cross-provider dedupe keys normalize accents and retain different nearby venues", () => {
  const first = localPlaceDedupeKey({ name: "Café Italia", address: "Avenida Malecón", latitude: 19.20501, longitude: -69.33601 });
  const duplicate = localPlaceDedupeKey({ name: "Cafe Italia", address: "Av. Malecon", latitude: 19.20502, longitude: -69.33602 });
  const differentBranch = localPlaceDedupeKey({ name: "Cafe Italia", address: "Avenida Malecón", latitude: 19.21001, longitude: -69.33601 });
  assert.equal(first, duplicate);
  assert.notEqual(first, differentBranch);
});

test("local places sort nearest-first without mutating the original or reordering when no origin exists", () => {
  const origin = { latitude: 42.91, longitude: -76.8 };
  const items = [
    { name: "Far", latitude: 42.93, longitude: -76.82 },
    { name: "Near", latitude: 42.9105, longitude: -76.8005 },
    { name: "No coordinates", latitude: null, longitude: null },
  ];
  const sorted = sortByStraightLineProximity(items, origin);
  assert.deepEqual(sorted.map((item) => item.name), ["Near", "Far", "No coordinates"]);
  assert.deepEqual(items.map((item) => item.name), ["Far", "Near", "No coordinates"]);
  assert.deepEqual(sortByStraightLineProximity(items, null).map((item) => item.name), ["Far", "Near", "No coordinates"]);
});

test("Geoapify restaurant normalization drops unrelated and uncategorized features, then deduplicates", () => {
  const payload = { features: [
    { properties: { name: "Pica Pollo", place_id: "p1", lat: 19.2, lon: -69.3, categories: ["catering.restaurant"] } },
    { properties: { name: "Pica Pollo", place_id: "p2", lat: 19.20001, lon: -69.30001, categories: ["catering.restaurant"] } },
    { properties: { name: "Avenida Malecón", place_id: "street1", lat: 19.21, lon: -69.3, categories: ["building", "catering.restaurant"] } },
    { properties: { name: "Unnamed place", place_id: "empty1", lat: 19.22, lon: -69.3, categories: [] } },
  ] };
  const rows = normalizeGeoapifyPlaces(payload, "restaurant");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Pica Pollo");
});

test("Geoapify activity normalization keeps attractions and rejects buildings", () => {
  const payload = { features: [
    { properties: { name: "Waterfall park", place_id: "a1", lat: 19.2, lon: -69.3, categories: ["tourism.attraction"] } },
    { properties: { name: "Roadside building", place_id: "b1", lat: 19.21, lon: -69.3, categories: ["building", "tourism.attraction"] } },
  ] };
  const rows = normalizeGeoapifyPlaces(payload, "activity");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Waterfall park");
});


test("Google Maps normalization and cross-provider merging both apply place-quality rules", () => {
  const root = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(root, "lib/providers/serpapi.ts"), "utf8");
  assert.match(source, /kind === "restaurant" && !isRestaurantCategory\(category\)/);
  assert.match(source, /kind === "activity" && !isUsefulActivityCategory\(category\)/);
  assert.match(source, /localPlaceDedupeKey\(\{ name: title, address: str\(item\.address\), latitude: lat, longitude: lon \}\)/);
});
