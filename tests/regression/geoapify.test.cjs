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
  buildGeoapifyStaticMapUrl,
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
  assert.equal(url.searchParams.get("format"), "geojson");
  assert.equal(url.searchParams.get("details"), "instruction_details");
  assert.equal(url.searchParams.get("waypoints"), "19.3,-69.56|19.31,-69.55");
  const route = parseGeoapifyRoute({ results: [{ distance: 3.2, distance_units: "mi", time: 960 }] });
  assert.equal(route.distance, "3.2 mi");
  assert.equal(route.duration, "16 min");
  assert.equal(route.durationSeconds, 960);
  const geoJsonRoute = parseGeoapifyRoute({
    properties: { units: "imperial" },
    features: [{
      properties: { distance: 1, time: 600, legs: [{ steps: [
        { instruction: { text: "Head east on Main Street" } },
        { instruction: { text: "Turn right onto Beach Road" } },
      ] }] },
      geometry: { type: "MultiLineString", coordinates: [[[-69.56, 19.30], [-69.555, 19.305], [-69.55, 19.31]]] },
    }],
  });
  assert.equal(geoJsonRoute.distance, "1.0 mi");
  assert.equal(geoJsonRoute.duration, "10 min");
  assert.deepEqual(geoJsonRoute.geometry, [[-69.56, 19.30], [-69.555, 19.305], [-69.55, 19.31]]);
  assert.deepEqual(geoJsonRoute.directions, ["Head east on Main Street", "Turn right onto Beach Road"]);
  assert.equal(parseGeoapifyRoute({ results: [] }), null);
});


test("Geoapify static route map includes the route geometry, start/end markers, and attribution", () => {
  const url = new URL(buildGeoapifyStaticMapUrl({
    geometry: [[-69.56, 19.30], [-69.555, 19.305], [-69.55, 19.31]],
    origin: { latitude: 19.30, longitude: -69.56 },
    destination: { latitude: 19.31, longitude: -69.55 },
    apiKey: "server-only-test-key",
  }));
  assert.equal(url.hostname, "maps.geoapify.com");
  assert.equal(url.pathname, "/v1/staticmap");
  assert.equal(url.searchParams.get("format"), "png");
  assert.equal(url.searchParams.get("attribution"), "default");
  assert.match(url.searchParams.get("geometry") || "", /^polyline:/);
  assert.match(url.searchParams.get("marker") || "", /text:A/);
  assert.match(url.searchParams.get("marker") || "", /text:B/);
  assert.equal(url.searchParams.get("apiKey"), "server-only-test-key");
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

test("activity discovery keeps one rich Google Maps search primary and Geoapify as the sparse-result fallback", () => {
  const root = path.resolve(__dirname, "../..");
  const provider = fs.readFileSync(path.join(root, "lib/providers/serpapi.ts"), "utf8");
  const start = provider.indexOf("async function searchPlacesWithFallback(");
  const end = provider.indexOf("export async function searchLiveTravel", start);
  const strategy = provider.slice(start, end);
  assert.match(strategy, /engine: "google_maps"/);
  assert.match(strategy, /searchGeoapifyPlaces/);
  assert.doesNotMatch(strategy, /engine: "google_local"/);
  assert.match(provider, /thumbnail: safeHttpUrl\(place\.thumbnail\)/);
  assert.match(provider, /rating: num\(place\.rating\)/);
  assert.match(provider, /reviews: num\(place\.reviews\)/);
});

test("experience cards retain rich Google Maps links and show route previews without duplicated map labels", () => {
  const root = path.resolve(__dirname, "../..");
  const workspace = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(workspace, /experience\.thumbnail \? "has-image" : "no-image"/);
  assert.match(workspace, /View on OpenStreetMap/);
  assert.match(workspace, /Open exact location in Google Maps/);
  assert.match(workspace, /route-map-preview/);
  assert.match(workspace, /A map preview was not returned for this route/);
  assert.match(workspace, /Open turn-by-turn navigation in Google Maps/);
  assert.doesNotMatch(workspace, /"Open OpenStreetMap"/);
  assert.match(workspace, /Search Viator for this place/);
  assert.match(workspace, /Search GetYourGuide for this place/);
  assert.match(css, /\.experience-card\.no-image\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(190px,\s*220px\)/);
  assert.match(css, /\.experience-card\.no-image\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
