const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildTripAssistantLocalFallback,
  buildTripAssistantResultActions,
  isExplicitResultNavigationFollowUp,
} = require("../../.test-build/lib/ai/trip-assistant.js");

function makeContext() {
  return {
    destination: "Las Terrenas, Dominican Republic",
    currency: "USD",
    stays: [{
      id: "stay-brisa-azul", name: "Brisa Azul Airbnb", source: "Google Hotels",
      propertyType: "Vacation rental", spaceType: "Entire place", amenities: [],
      latitude: 19.2900, longitude: -69.6000, totalPrice: 1200, nightlyPrice: 400,
      rating: 4.8, reviews: 12,
    }],
    experiences: [
      { id: "beach-pb", kind: "activity", name: "Playa Bonita", category: "Tourist attraction", address: "Las Terrenas", rating: null, price: "", latitude: 19.3180, longitude: -69.5700 },
      { id: "activity-waterfall", kind: "activity", name: "El Limón Waterfall", category: "Waterfall attraction", address: "El Limón, Samaná", rating: 4.9, price: "", latitude: 19.2760, longitude: -69.4400 },
      { id: "activity-zipline", kind: "activity", name: "Samaná Zipline Adventure", category: "Adventure tour", address: "Samaná", rating: 4.8, price: "", latitude: 19.2050, longitude: -69.3300 },
      { id: "activity-closed", kind: "activity", name: "Closed Nature Center", category: "Nature attraction", address: "Las Terrenas", rating: 5.0, price: "", openState: "Temporarily closed", latitude: 19.2950, longitude: -69.5900 },
      { id: "restaurant-cayuco", kind: "restaurant", name: "El Cayuco de la Bonita", category: "Spanish restaurant", address: "Las Terrenas", rating: 4.3, price: "", latitude: 19.3181, longitude: -69.5701 },
      { id: "restaurant-campuno", kind: "restaurant", name: "Campuno Beach Club", category: "Dominican restaurant", address: "Las Terrenas", rating: 4.8, price: "", latitude: 19.3100, longitude: -69.5600 },
    ],
    selected: {
      stay: "Brisa Azul Airbnb", stayId: "stay-brisa-azul",
      schedule: [{ id: "restaurant-cayuco", name: "El Cayuco de la Bonita", kind: "restaurant", date: "2026-12-26", slot: "Dinner" }],
    },
  };
}

const priorRestaurantConversation = [
  { role: "user", content: "Which restaurant is closest to Playa Bonita?" },
  { role: "assistant", content: "Closest loaded restaurants to Playa Bonita: El Cayuco de la Bonita." },
  { role: "user", content: "Which restaurant is similar to El Cayuco near my Airbnb?" },
  { role: "assistant", content: "Similar restaurants near your Airbnb: Campuno Beach Club." },
];

test("a new activities question overrides the prior restaurant conversation", () => {
  const context = makeContext();
  const question = "What activities besides beaches should I go to?";
  const answer = buildTripAssistantLocalFallback(question, context, priorRestaurantConversation);
  assert.match(answer, /non-beach activities and attractions/i);
  assert.match(answer, /El Limón Waterfall/);
  assert.match(answer, /Samaná Zipline Adventure/);
  assert.doesNotMatch(answer, /El Cayuco de la Bonita/);
  assert.doesNotMatch(answer, /Campuno Beach Club/);
  assert.doesNotMatch(answer, /Playa Bonita/);
  assert.doesNotMatch(answer, /Closed Nature Center/);
});

test("new category question is not treated as navigation to previous result links", () => {
  const context = makeContext();
  assert.equal(isExplicitResultNavigationFollowUp("What activities besides beaches should I go to?", context), false);
  assert.equal(isExplicitResultNavigationFollowUp("What activities like El Limón Waterfall should I go to?", context), false);
  assert.equal(isExplicitResultNavigationFollowUp("Can you give me the direct link to Campuno Beach Club?", context), true);
  assert.equal(isExplicitResultNavigationFollowUp("Open that restaurant", context), true);
});

test("activity answer actions contain only matching activity results, not old restaurant links", () => {
  const context = makeContext();
  const question = "What activities besides beaches should I go to?";
  const answer = buildTripAssistantLocalFallback(question, context, priorRestaurantConversation);
  const actions = buildTripAssistantResultActions(question, priorRestaurantConversation, context, answer);
  assert.deepEqual(actions.map((action) => action.kind), ["activity", "activity"]);
  assert.deepEqual(actions.map((action) => action.label), ["El Limón Waterfall", "Samaná Zipline Adventure"]);
});

test("when only beaches are loaded, activity request does not substitute restaurants", () => {
  const context = makeContext();
  context.experiences = context.experiences.filter((item) => item.kind !== "activity" || item.id === "beach-pb");
  const answer = buildTripAssistantLocalFallback("What activities besides beaches should I go to?", context, priorRestaurantConversation);
  assert.match(answer, /no non-beach activities or attractions/i);
  assert.match(answer, /won't substitute restaurant/i);
  assert.doesNotMatch(answer, /El Cayuco de la Bonita|Campuno Beach Club/);
});
