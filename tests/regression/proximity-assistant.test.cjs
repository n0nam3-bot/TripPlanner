const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildTripAssistantLocalFallback,
  isTripfinderQuestionInScope,
  sanitizeTripAssistantContext,
} = require("../../.test-build/lib/ai/trip-assistant.js");

const origin = {
  label: "Northeast College of Health Sciences",
  address: "2000 W Genesee St, Seneca Falls, NY 13148, USA",
  latitude: 42.9100,
  longitude: -76.8000,
  confidence: 0.94,
};

const context = {
  destination: "Seneca Falls, New York",
  currency: "USD",
  startingPoint: origin,
  stays: [],
  experiences: [
    { id: "r1", kind: "restaurant", name: "Perfect Pair Hospitality", category: "Restaurant", address: "64 W Bayard St, Seneca Falls, NY", rating: 4.9, price: "", latitude: 42.9108, longitude: -76.7990 },
    { id: "r2", kind: "restaurant", name: "Farther Dining", category: "Restaurant", address: "Seneca Falls, NY", rating: 4.5, price: "", latitude: 42.9300, longitude: -76.8200 },
    { id: "a1", kind: "activity", name: "When Anthony Met Stanton Statue", category: "Historical landmark", address: "E Bayard St, Seneca Falls, NY", rating: 4.5, price: "", latitude: 42.9110, longitude: -76.7988 },
  ],
};

test("assistant treats a named college as a valid travel starting point without a selected stay", () => {
  const question = "Which restaurant is closest to Northeast College of Health Sciences?";
  assert.equal(isTripfinderQuestionInScope(question, [], context), true);
  const answer = buildTripAssistantLocalFallback(question, context);
  assert.match(answer, /Closest loaded restaurants to your starting point/);
  assert.match(answer, /Perfect Pair Hospitality/);
  assert.doesNotMatch(answer, /selected stay|select a property first/i);
  assert.doesNotMatch(answer, /Farther Dining/);
});

test("assistant can rank nearby attractions against the same non-hotel starting point", () => {
  const question = "Which attraction is closest to Northeast College of Health Sciences?";
  const answer = buildTripAssistantLocalFallback(question, context);
  assert.match(answer, /Closest loaded activities and attractions/);
  assert.match(answer, /When Anthony Met Stanton Statue/);
  assert.match(answer, /straight-line distances/);
});

test("starting point survives assistant context sanitization but invalid coordinates are removed", () => {
  const safe = sanitizeTripAssistantContext(context);
  assert.equal(safe.startingPoint.label, origin.label);
  assert.equal(safe.startingPoint.longitude, origin.longitude);
  const unsafe = sanitizeTripAssistantContext({ ...context, startingPoint: { ...origin, latitude: 200 } });
  assert.equal(unsafe.startingPoint, undefined);
});
