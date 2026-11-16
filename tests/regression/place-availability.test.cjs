const test = require("node:test");
const assert = require("node:assert/strict");
const { isUnavailablePlaceStatus } = require("../../.test-build/lib/trip-planner/place-quality.js");

test("explicitly temporarily/permanently closed place statuses are unavailable", () => {
  assert.equal(isUnavailablePlaceStatus("Temporarily closed"), true);
  assert.equal(isUnavailablePlaceStatus("Permanently closed"), true);
  assert.equal(isUnavailablePlaceStatus("Closed permanently"), true);
});

test("ordinary daily closed and open hours are not treated as permanent closure", () => {
  assert.equal(isUnavailablePlaceStatus("Closed · Opens 3 PM"), false);
  assert.equal(isUnavailablePlaceStatus("Open · Closes 11 PM"), false);
  assert.equal(isUnavailablePlaceStatus("Closed · Opens at 6:30 PM"), false);
  assert.equal(isUnavailablePlaceStatus(undefined), false);
});
