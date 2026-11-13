const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { getDestinationAreaGeo } = require("../../.test-build/lib/trip-planner/location-suggestions.js");
const {
  geoapifyCategories,
  buildGeoapifyPlacesUrl,
  normalizeGeoapifyPlaces,
  buildGeoapifyRouteUrl,
  parseGeoapifyRoute,
  estimateGeoapifyRouteCredits,
  resolveGeoapifyCreditCaps,
} = require("../../.test-build/lib/trip-planner/geoapify-format.js");

test("Geoapify GET Places searches use the supported local circle filter and proximity bias", () => {
  assert.deepEqual(geoapifyCategories("restaurant"), ["catering.restaurant", "catering.cafe", "catering.fast_food"]);
  assert.ok(geoapifyCategories("activity").includes("tourism.attraction"));
  const url = new URL(buildGeoapifyPlacesUrl({
    center: { latitude: 19.205, longitude: -69.336 },
    radiusMeters: 40_000,
    kind: "restaurant",
    apiKey: "server-only-test-key",
  }));
  assert.equal(url.origin, "https://api.geoapify.com");
  assert.equal(url.pathname, "/v2/places");
  assert.equal(url.searchParams.get("filter"), "circle:-69.336,19.205,40000");
  assert.equal(url.searchParams.get("bias"), "proximity:-69.336,19.205");
  assert.equal(url.searchParams.has("countrycode"), false);
  assert.equal(url.searchParams.get("limit"), "40");
  assert.equal(url.searchParams.get("apiKey"), "server-only-test-key");
});

test("Geoapify normalizes valid place features with OSM map links and no fabricated ratings", () => {
  const places = normalizeGeoapifyPlaces({
    features: [
      { properties: {
        place_id: "osm-place-1",
        name: "Playa Bonita",
        formatted: "Playa Bonita, Las Terrenas, Dominican Republic",
        lat: 19.306,
        lon: -69.56,
        categories: ["tourism.attraction", "beach"],
        website: "https://example.test/",
      } },
      { properties: { name: "No coordinate listing" } },
    ],
  }, "activity");
  assert.equal(places.length, 1);
  assert.equal(places[0].title, "Playa Bonita");
  assert.equal(places[0].source, "Geoapify / OpenStreetMap");
  assert.match(places[0].mapsUrl, /openstreetmap\.org/);
  assert.equal(places[0].website, "https://example.test/");
  assert.equal(Object.hasOwn(places[0], "rating"), false);
});

test("Geoapify route requests use coordinate waypoints and report route estimates", () => {
  const url = new URL(buildGeoapifyRouteUrl({
    origin: { latitude: 19.30, longitude: -69.56 },
    destination: { latitude: 19.31, longitude: -69.55 },
    apiKey: "server-only-test-key",
  }));
  assert.equal(url.pathname, "/v1/routing");
  assert.equal(url.searchParams.get("mode"), "drive");
  assert.equal(url.searchParams.get("units"), "imperial");
  assert.equal(url.searchParams.get("waypoints"), "19.3,-69.56|19.31,-69.55");
  const route = parseGeoapifyRoute({ results: [{ distance: 3.2, distance_units: "mi", time: 960 }] });
  assert.equal(route.distance, "3.2 mi");
  assert.equal(route.duration, "16 min");
  assert.equal(route.durationSeconds, 960);
  assert.equal(parseGeoapifyRoute({ results: [] }), null);
});

test("Geoapify routing credit estimate includes a safety buffer for road distance", () => {
  const credits = estimateGeoapifyRouteCredits(
    { latitude: 19.30, longitude: -69.56 },
    { latitude: 19.31, longitude: -69.55 },
  );
  assert.equal(credits, 2);
  assert.ok(credits >= 1);
});


test("Geoapify safety caps share one bounded default and never exceed Tripfinder limits", () => {
  assert.deepEqual(resolveGeoapifyCreditCaps(), { dailyCap: 2400, clientDailyCap: 80 });
  assert.deepEqual(resolveGeoapifyCreditCaps({ dailyCap: "5000", clientDailyCap: "900" }), { dailyCap: 2800, clientDailyCap: 300 });
  assert.deepEqual(resolveGeoapifyCreditCaps({ dailyCap: "not-a-number", clientDailyCap: 0 }), { dailyCap: 2400, clientDailyCap: 1 });
});


test("Las Terrenas uses its own local anchor instead of the Samaná town center", () => {
  const lasTerrenas = getDestinationAreaGeo("Las Terrenas, Samaná, Dominican Republic");
  const samana = getDestinationAreaGeo("Samaná, Dominican Republic");
  assert.ok(lasTerrenas);
  assert.ok(samana);
  assert.notEqual(lasTerrenas.latitude, samana.latitude);
  assert.notEqual(lasTerrenas.longitude, samana.longitude);
  assert.equal(lasTerrenas.restaurantRadiusMiles, 6);
  assert.equal(lasTerrenas.activityRadiusMiles, 12);
});

test("image-free experience cards use full content width and a single OpenStreetMap label", () => {
  const root = path.resolve(__dirname, "../..");
  const workspace = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(workspace, /experience\.thumbnail \? "has-image" : "no-image"/);
  assert.match(workspace, /"View on OpenStreetMap"/);
  assert.doesNotMatch(workspace, /"Open OpenStreetMap"/);
  assert.match(css, /\.experience-card\.no-image\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(190px,\s*220px\)/);
  assert.match(css, /\.experience-card\.no-image\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
