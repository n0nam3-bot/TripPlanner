const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("visible results exclude unavailable provider status while preserving selected items for warning", () => {
  const root = path.resolve(__dirname, "../..");
  const workspace = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");
  const assistant = fs.readFileSync(path.join(root, "lib/ai/trip-assistant.ts"), "utf8");
  assert.match(workspace, /allResultExperiences\.filter\(\(experience\) => !isUnavailablePlaceStatus\(experience\.openState\)\)/);
  assert.match(workspace, /selected-place-availability-warning/);
  assert.match(assistant, /const restaurants = allRestaurants\.filter\(\(item\) => !isUnavailablePlaceStatus\(item\.openState\)\)/);
  assert.match(assistant, /!isUnavailablePlaceStatus\(item\.openState\)/);
});
