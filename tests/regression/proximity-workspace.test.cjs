const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");

test("activities and dining searches show an independent optional starting point", () => {
  assert.match(source, /search\.components\.includes\("activities"\)\s*&&\s*<>\s*<ProximityStartingPointPanel/);
  assert.match(source, /placeholder=\{defaultOriginLabel \? "Use a different starting point \(optional\)" : "Hotel, Airbnb, college, venue or street address"\}/);
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


test("the selected hotel or Airbnb is the default origin for both activities and restaurants", () => {
  assert.match(source, /defaultOriginLabel=\{selection\.hotel\?\.name\}/);
  assert.match(source, /activityExperiences\.map\(\(experience\) => <ExperienceResult[^>]*selectedHotel=\{selection\.hotel\}/);
  assert.match(source, /restaurantExperiences\.map\(\(experience\) => <ExperienceResult[^>]*selectedHotel=\{selection\.hotel\}/);
  assert.match(source, /: selectedHotel && selectedStayLocation/);
  assert.doesNotMatch(source, /isRestaurant && selectedHotel && selectedStayLocation/);
});

test("other hotel and Airbnb options stop appearing as competing proximity origins after a stay is selected", () => {
  assert.match(source, /const nearbyStays = !selectedHotel && search\.components\.includes\("stays"\)/);
  assert.match(source, /Using your selected stay by default:/);
  assert.match(source, /Your selected hotel or Airbnb is the default origin for activities and restaurants/);
});


test("local activities and restaurants rank by the resolved custom origin or selected stay", () => {
  assert.match(source, /import \{ sortByStraightLineProximity \} from "@\/lib\/trip-planner\/place-quality"/);
  assert.match(source, /const proximityOrigin = startingPoints\[destination\.id\][\s\S]{0,360}selection\.hotel\?\.latitude/);
  assert.match(source, /sortByStraightLineProximity\(resultExperiences\.filter\(\(item\) => item\.kind === "activity"\), proximityOrigin\)/);
  assert.match(source, /sortByStraightLineProximity\(resultExperiences\.filter\(\(item\) => item\.kind === "restaurant"\), proximityOrigin\)/);
  assert.match(source, /Restaurants are sorted nearest-first by straight-line distance/);
});

test("assistant receives up to 30 loaded activities and 30 loaded restaurants without additional searches", () => {
  assert.match(source, /assistantExperiences\.filter\(\(experience\) => experience\.kind === "activity"\)\.slice\(0, 30\)/);
  assert.match(source, /assistantExperiences\.filter\(\(experience\) => experience\.kind === "restaurant"\)\.slice\(0, 30\)/);
  assert.match(source, /const assistantExperienceRows = \[/);
});
