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


test("assistant ranks loaded properties by distance to a named beach landmark", () => {
  const landmarkContext = {
    destination: "Las Terrenas, Dominican Republic",
    currency: "USD",
    stays: [
      { id: "far", name: "Far Beach Villa", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], latitude: 19.330, longitude: -69.550, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
      { id: "near", name: "Casa Bonita", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], latitude: 19.301, longitude: -69.550, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
      { id: "middle", name: "Villa Estela", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], latitude: 19.310, longitude: -69.550, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
    ],
    experiences: [
      { id: "pl-bonita", kind: "activity", name: "Playa Bonita", category: "Tourist attraction", address: "Las Terrenas", rating: null, price: "", latitude: 19.300, longitude: -69.550 },
    ],
  };
  const answer = buildTripAssistantLocalFallback("Which stay would be closest to Playa Bonita?", landmarkContext);
  assert.match(answer, /Closest loaded stays to Playa Bonita/);
  assert.ok(answer.indexOf("Casa Bonita") < answer.indexOf("Villa Estela"));
  assert.ok(answer.indexOf("Villa Estela") < answer.indexOf("Far Beach Villa"));
  assert.match(answer, /straight-line/);
  assert.match(answer, /not walking or driving time/);
});

test("assistant understands the hotel-or-Airbnb phrasing and does not claim a requested time limit from coordinates", () => {
  const landmarkContext = {
    destination: "Las Terrenas, Dominican Republic",
    currency: "USD",
    stays: [
      { id: "near", name: "Casa Bonita", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], latitude: 19.301, longitude: -69.550, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
    ],
    experiences: [
      { id: "pl-bonita", kind: "activity", name: "Playa Bonita", category: "Tourist attraction", address: "Las Terrenas", rating: null, price: "", latitude: 19.300, longitude: -69.550 },
    ],
  };
  const answer = buildTripAssistantLocalFallback("What hotel or Airbnb is closest to Playa Bonita?", landmarkContext);
  assert.match(answer, /Casa Bonita/);
  const timedAnswer = buildTripAssistantLocalFallback("Which stay is within 5 minutes of Playa Bonita?", landmarkContext);
  assert.match(timedAnswer, /do not establish travel time or whether any property is within 5 minutes/);
});

test("assistant compares provider-listed nearby-place routes only within a comparable requested mode", () => {
  const routeContext = {
    destination: "Las Terrenas, Dominican Republic",
    currency: "USD",
    stays: [
      { id: "slow", name: "Slow Villa", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], nearbyPlaces: [{ name: "Playa Bonita", category: "beach", transportations: [{ type: "drive", duration: "8 min" }] }], latitude: null, longitude: null, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
      { id: "fast", name: "Quick Villa", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], nearbyPlaces: [{ name: "Playa Bonita", category: "beach", transportations: [{ type: "drive", duration: "4 min" }] }], latitude: null, longitude: null, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
    ],
    experiences: [],
  };
  const answer = buildTripAssistantLocalFallback("Which stay is closest by driving to Playa Bonita?", routeContext);
  assert.match(answer, /Loaded drive routes to Playa Bonita/);
  assert.ok(answer.indexOf("Quick Villa") < answer.indexOf("Slow Villa"));
  assert.match(answer, /Only properties with comparable route data are shown/);
});

test("assistant reports an unknown landmark instead of guessing from unrelated loaded places", () => {
  const unknownContext = { ...context, stays: [{ id: "s1", name: "One Stay", source: "Provider", propertyType: "Hotel", spaceType: "Room", amenities: [], latitude: 42.91, longitude: -76.8, totalPrice: null, nightlyPrice: null, rating: null, reviews: null }], experiences: [] };
  const answer = buildTripAssistantLocalFallback("Which stay is closest to Playa Bonita?", unknownContext);
  assert.match(answer, /couldn't find \*\*Playa Bonita\*\*/);
  assert.match(answer, /I won't guess/);
});

test("assistant context retains the complete bounded local place set for nearest-result comparisons", () => {
  const rows = Array.from({ length: 60 }, (_, index) => ({ id: `a${index}`, kind: "activity", name: `Activity ${index}`, category: "Tourist attraction", address: "Destination", rating: null, price: "", latitude: 42.91, longitude: -76.8 }));
  assert.equal(sanitizeTripAssistantContext({ ...context, experiences: rows }).experiences.length, 60);
});

test("assistant applies a requested minute limit only to loaded comparable routes", () => {
  const routeLimitContext = {
    destination: "Las Terrenas, Dominican Republic",
    currency: "USD",
    stays: [
      { id: "slow", name: "Slow Villa", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], nearbyPlaces: [{ name: "Playa Bonita", category: "beach", transportations: [{ type: "drive", duration: "8 min" }] }], latitude: 19.33, longitude: -69.55, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
      { id: "fast", name: "Quick Villa", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], nearbyPlaces: [{ name: "Playa Bonita", category: "beach", transportations: [{ type: "drive", duration: "4 min" }] }], latitude: 19.31, longitude: -69.55, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
    ],
    experiences: [
      { id: "pl-bonita", kind: "activity", name: "Playa Bonita", category: "Tourist attraction", address: "Las Terrenas", rating: null, price: "", latitude: 19.300, longitude: -69.550 },
    ],
  };
  const answer = buildTripAssistantLocalFallback("Which stay is within 5 minutes of Playa Bonita?", routeLimitContext);
  assert.match(answer, /Loaded drive routes to Playa Bonita within 5 minutes/);
  assert.match(answer, /Quick Villa/);
  assert.doesNotMatch(answer, /Slow Villa/);
});

test("assistant states when no comparable loaded route meets the requested minute limit", () => {
  const routeLimitContext = {
    destination: "Las Terrenas, Dominican Republic",
    currency: "USD",
    stays: [
      { id: "slow", name: "Slow Villa", source: "Provider", propertyType: "Vacation rental", spaceType: "Entire place", amenities: [], nearbyPlaces: [{ name: "Playa Bonita", category: "beach", transportations: [{ type: "drive", duration: "8 min" }] }], latitude: 19.33, longitude: -69.55, totalPrice: null, nightlyPrice: null, rating: null, reviews: null },
    ],
    experiences: [
      { id: "pl-bonita", kind: "activity", name: "Playa Bonita", category: "Tourist attraction", address: "Las Terrenas", rating: null, price: "", latitude: 19.300, longitude: -69.550 },
    ],
  };
  const answer = buildTripAssistantLocalFallback("Which stay is within 5 minutes of Playa Bonita?", routeLimitContext);
  assert.match(answer, /No loaded drive route to Playa Bonita is reported within 5 minutes/);
});
