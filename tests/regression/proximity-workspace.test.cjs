const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");

test("activities and dining searches show an independent optional starting point", () => {
  assert.match(source, /search\.components\.includes\("activities"\)\s*&&\s*<>\s*<ProximityStartingPointPanel/);
  assert.match(source, /placeholder="Hotel, Airbnb, college, venue or street address"/);
  assert.match(source, /no hotel booking required/i);
});

test("airport references and airport badge only appear when flights were requested", () => {
  assert.match(source, /search\.components\.includes\("flights"\)\s*&&\s*airport\s*&&\s*airportMiles !== null/);
  assert.match(source, /search\.components\.includes\("flights"\)\s*&&\s*airportCode\s*&&\s*<span className="planner-airport"/);
});

test("unrequested stays are not shown as activity or restaurant proximity anchors", () => {
  assert.match(source, /search\.components\.includes\("stays"\)\s*&&\s*experience\.latitude/);
});

test("starting-point distance and route actions use the resolved coordinates", () => {
  assert.match(source, /startingPointMiles !== null \? `\$\{distanceLabel\(startingPointMiles\)\} straight-line from \$\{startingPoint\.label\}`/);
  assert.match(source, /label="Show driving route from your starting point"/);
  assert.match(source, /originCoordinates=\{\{ latitude: startingPoint\.latitude, longitude: startingPoint\.longitude \}\}/);
});

test("starting point remains browser-local and is explicitly excluded from public share snapshots", () => {
  assert.match(source, /tripfinder:proximity-origin:v1:/);
  assert.match(source, /not included in the public trip share link/i);
  assert.doesNotMatch(source, /buildSavedTripSnapshot\(search, recommendations, states, selections, startingPoints/);
});
