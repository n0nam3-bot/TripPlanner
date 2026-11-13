const test = require("node:test");
const assert = require("node:assert/strict");
const { extractStartingPointStatement, extractProximityAnchorQuestion, isValidProximityStartingPoint } = require("../../.test-build/lib/trip-planner/proximity.js");

test("starting point statement recognizes an ordinary hotel or lodging statement", () => {
  assert.equal(extractStartingPointStatement("I'm staying at Northeast College of Health Sciences"), "Northeast College of Health Sciences");
  assert.equal(extractStartingPointStatement("im staying are Northeast College of Health Sciences"), "Northeast College of Health Sciences");
  assert.equal(extractStartingPointStatement("We are staying near 12 Fall Street, Seneca Falls, NY"), "12 Fall Street, Seneca Falls, NY");
  assert.equal(extractStartingPointStatement("My Airbnb is Villa Estela at Monserrat 2"), "Villa Estela at Monserrat 2");
});

test("starting point statement rejects vague location references", () => {
  assert.equal(extractStartingPointStatement("I'm staying at the hotel"), null);
  assert.equal(extractStartingPointStatement("I like this restaurant"), null);
});

test("proximity questions can supply a named landmark as an on-demand anchor", () => {
  assert.equal(extractProximityAnchorQuestion("Which restaurant is closest to Northeast College of Health Sciences?"), "Northeast College of Health Sciences");
  assert.equal(extractProximityAnchorQuestion("Which attractions are near the Seneca Falls Visitor Center?"), "the Seneca Falls Visitor Center");
  assert.equal(extractProximityAnchorQuestion("Which restaurant is closest to my selected stay?"), null);
});

test("starting point coordinate payload is strictly validated", () => {
  assert.equal(isValidProximityStartingPoint({ label: "Northeast College", address: "Seneca Falls, NY", latitude: 42.9, longitude: -76.8, confidence: 0.9 }), true);
  assert.equal(isValidProximityStartingPoint({ label: "Bad", address: "Bad", latitude: 120, longitude: 0, confidence: 0.9 }), false);
  assert.equal(isValidProximityStartingPoint(null), false);
});
