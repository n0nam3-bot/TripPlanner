const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildTripAssistantLocalFallback,
  buildTripAssistantResultActions,
  sanitizeTripAssistantContext,
} = require("../../.test-build/lib/ai/trip-assistant.js");

const makeContext = () => ({
  destination: "Las Terrenas, Dominican Republic",
  currency: "USD",
  stays: [{
    id: "stay-brisa-azul",
    name: "Brisa Azul | Poolfront | Walk to Beach | Wi-Fi",
    source: "Google Hotels",
    propertyType: "Vacation rental",
    spaceType: "Entire place",
    amenities: [],
    latitude: 19.2900,
    longitude: -69.6000,
    totalPrice: 1200,
    nightlyPrice: 400,
    rating: 4.8,
    reviews: 12,
  }],
  experiences: [
    { id: "beach-pb-1", kind: "activity", name: "Playa Bonita", category: "Tourist attraction", address: "Las Terrenas, Dominican Republic", rating: null, price: "", latitude: 19.3180, longitude: -69.5700 },
    // Duplicate provider record for the same beach: should not produce a second result link.
    { id: "beach-pb-2", kind: "activity", name: "Playa Bonita", category: "Tourist attraction", address: "Las Terrenas, Dominican Republic", rating: null, price: "", latitude: 19.3260, longitude: -69.5700 },
    { id: "beach-coson", kind: "activity", name: "Playa Cosón", category: "Tourist attraction", address: "Las Terrenas, Dominican Republic", rating: null, price: "", latitude: 19.3500, longitude: -69.5500 },
    { id: "rest-el-cayuco", kind: "restaurant", name: "El Cayuco de la Bonita", category: "Spanish restaurant", address: "Las Terrenas, Dominican Republic", rating: 4.7, price: "", latitude: 19.3181, longitude: -69.5701 },
    { id: "rest-parrilla", kind: "restaurant", name: "La Parrilla", category: "Restaurant", address: "Las Terrenas, Dominican Republic", rating: 4.6, price: "", latitude: 19.3190, longitude: -69.5700 },
    { id: "rest-casita", kind: "restaurant", name: "La Casita", category: "Restaurant", address: "Las Terrenas, Dominican Republic", rating: 4.5, price: "", latitude: 19.3501, longitude: -69.5500 },
  ],
  selected: {
    stay: "Brisa Azul | Poolfront | Walk to Beach | Wi-Fi",
    stayId: "stay-brisa-azul",
    schedule: [{ id: "beach-coson", name: "Playa Cosón", kind: "activity", date: "2026-12-27", slot: "Afternoon" }],
  },
});

test("a named beach is the restaurant proximity origin, not the selected stay", () => {
  const context = makeContext();
  const answer = buildTripAssistantLocalFallback("Which restaurant is closest to Playa Bonita?", context);
  assert.match(answer, /Closest loaded restaurants to Playa Bonita/);
  assert.match(answer, /El Cayuco de la Bonita/);
  assert.doesNotMatch(answer, /Brisa Azul/);
  assert.doesNotMatch(answer, /La Casita/);
});

test("the beach selected in the itinerary is resolved by its selected result ID", () => {
  const context = makeContext();
  const answer = buildTripAssistantLocalFallback("What's the closest restaurant to the beach I selected?", context);
  assert.match(answer, /Closest loaded restaurants to Playa Cosón/);
  assert.match(answer, /La Casita/);
  assert.doesNotMatch(answer, /El Cayuco de la Bonita/);
});

test("next-closest follow-up reuses the beach target and excludes a previously recommended/selected restaurant", () => {
  const context = makeContext();
  const history = [
    { role: "user", content: "Which restaurant is closest to Playa Bonita?" },
    { role: "assistant", content: "Closest loaded restaurants to Playa Bonita: El Cayuco de la Bonita — 0.01 mi straight-line." },
  ];
  const question = "I already have El Cayuco de la Bonita selected, so which is the next closest?";
  const answer = buildTripAssistantLocalFallback(question, context, history);
  assert.match(answer, /Closest loaded restaurants to Playa Bonita/);
  assert.match(answer, /La Parrilla/);
  assert.doesNotMatch(answer, /El Cayuco de la Bonita/);
});

test("selected schedule IDs survive sanitization so itinerary exclusions remain reliable", () => {
  const safe = sanitizeTripAssistantContext(makeContext());
  assert.equal(safe.selected.schedule[0].id, "beach-coson");
  assert.equal(safe.selected.schedule[0].name, "Playa Cosón");
});

test("result actions deduplicate duplicate beach records and do not link an excluded restaurant", () => {
  const context = makeContext();
  const question = "I already have El Cayuco de la Bonita selected, so which restaurant is next closest to Playa Bonita?";
  const answer = "Closest loaded restaurants to Playa Bonita: La Parrilla — 0.07 mi straight-line.";
  const actions = buildTripAssistantResultActions(question, [], context, answer);
  assert.equal(actions.filter((action) => action.label === "Playa Bonita").length, 1);
  assert.equal(actions.filter((action) => action.label === "El Cayuco de la Bonita").length, 0);
  assert.equal(actions.filter((action) => action.label === "La Parrilla").length, 1);
});

test("an unresolved beach does not silently fall back to the selected stay", () => {
  const context = { ...makeContext(), experiences: makeContext().experiences.filter((item) => item.kind === "restaurant") };
  const answer = buildTripAssistantLocalFallback("Which restaurant is closest to the beach I selected?", context);
  assert.match(answer, /can't identify a beach with usable coordinates/i);
  assert.match(answer, /won't substitute your selected stay/i);
  assert.doesNotMatch(answer, /Closest loaded restaurants to your selected stay/);
});
