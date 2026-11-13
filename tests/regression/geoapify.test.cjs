const test = require("node:test");
const assert = require("node:assert/strict");
const {
  geoapifyCategories,
  buildGeoapifyPlacesUrl,
  normalizeGeoapifyPlaces,
  buildGeoapifyRouteUrl,
  buildGeoapifyStaticMapRequest,
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

test("Geoapify route requests ask for route geometry and turn-by-turn instruction details", () => {
  const url = new URL(buildGeoapifyRouteUrl({
    origin: { latitude: 19.30, longitude: -69.56 },
    destination: { latitude: 19.31, longitude: -69.55 },
    apiKey: "server-only-test-key",
  }));
  assert.equal(url.pathname, "/v1/routing");
  assert.equal(url.searchParams.get("mode"), "drive");
  assert.equal(url.searchParams.get("units"), "imperial");
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(url.searchParams.get("details"), "instruction_details,polyline6");
  assert.equal(url.searchParams.get("waypoints"), "19.3,-69.56|19.31,-69.55");
  const route = parseGeoapifyRoute({ results: [{ distance: 3.2, distance_units: "mi", time: 960 }] });
  assert.equal(route.distance, "3.2 mi");
  assert.equal(route.duration, "16 min");
  assert.equal(route.durationSeconds, 960);

  const detailed = parseGeoapifyRoute({ results: [{
    distance: 0.2,
    distance_units: "Miles",
    time: 240,
    polyline6: "_c|`B~z|sQ??",
    legs: [{ steps: [
      { instruction: { text: "Head east on Calle 27 de Febrero" } },
      { instruction: { text: "Turn right toward Playa Punta Popy" } },
      { instruction: { text: "" } },
    ] }],
  }] });
  assert.equal(detailed.distance, "0.2 mi");
  assert.equal(detailed.duration, "4 min");
  assert.equal(detailed.polyline6, "_c|`B~z|sQ??");
  assert.deepEqual(detailed.directions, ["Head east on Calle 27 de Febrero", "Turn right toward Playa Punta Popy"]);

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


test("Geoapify static route map uses a POST body with route polyline, endpoint pins, and attribution", () => {
  const request = buildGeoapifyStaticMapRequest({
    geometry: [[-69.56, 19.30], [-69.555, 19.305], [-69.55, 19.31]],
    polyline6: "_c|`B~z|sQ??",
    origin: { latitude: 19.30, longitude: -69.56 },
    destination: { latitude: 19.31, longitude: -69.55 },
    apiKey: "server-only-test-key",
  });
  const url = new URL(request.url);
  assert.equal(url.hostname, "maps.geoapify.com");
  assert.equal(url.pathname, "/v1/staticmap");
  assert.equal(url.searchParams.get("apiKey"), "server-only-test-key");
  assert.equal(url.searchParams.get("attribution"), "default");
  assert.equal(request.body.format, "jpeg");
  assert.equal(request.body.geometries[0].type, "polyline6");
  assert.equal(request.body.geometries[0].value, "_c|`B~z|sQ??");
  assert.equal(request.body.markers.length, 2);
  assert.equal(request.body.markers[0].text, "A");
  assert.equal(request.body.markers[1].text, "B");
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
  const { getDestinationAreaGeo } = require("../../.test-build/lib/trip-planner/location-suggestions.js");
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
  const fs = require("node:fs");
  const path = require("node:path");
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

test("route preview passes the server-generated map and only renders non-empty directions", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "../..");
  const workspace = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");
  assert.match(workspace, /mapImageDataUrl/);
  assert.match(workspace, /mapWarning/);
  assert.match(workspace, /item\.trim\(\)/);
  assert.match(workspace, /route-map-preview/);
  assert.match(workspace, /Open turn-by-turn navigation in Google Maps/);
});

test("Geoapify provider fetches and caches a server-side static map image with the route", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const provider = fs.readFileSync(path.resolve(__dirname, "../../lib/providers/geoapify.ts"), "utf8");
  assert.match(provider, /buildGeoapifyStaticMapRequest/);
  assert.match(provider, /method: "POST"/);
  assert.match(provider, /reserveGeoapifyCredits\(input\.clientUsageKey, 5\)/);
  assert.match(provider, /mapImageDataUrl/);
  assert.match(provider, /geoapify-driving-route-v2/);
});
