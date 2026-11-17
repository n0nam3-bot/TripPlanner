const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function loadSearchPreferenceModule() {
  const filename = path.join(root, "lib/ai/search-preferences.ts");
  const javascript = ts.transpileModule(read("lib/ai/search-preferences.ts"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = Module.prototype.require;
  compiled.require = function (request) {
    if (request === "@/lib/trip-planner/flight-routing") {
      return { LAYOVER_COUNTRY_OPTIONS: ["Dominican Republic", "United States", "Jamaica", "Puerto Rico", "Canada", "Mexico", "Albania"] };
    }
    if (request === "@/lib/trip-planner/airports") {
      return {
        resolveAirportCode: (value) => {
          const normalized = String(value).trim().toUpperCase();
          const aliases = { NEWARK: "EWR", "NEW YORK": "NYC", "LAS TERRENAS": "AZS", "PUNTA CANA": "PUJ", TIRANA: "TIA" };
          return aliases[normalized] || (/^[A-Z]{3}$/.test(normalized) ? normalized : null);
        },
      };
    }
    return nativeRequire.call(this, request);
  };
  compiled._compile(javascript, filename);
  return compiled.exports;
}

const { parseDeterministicSearchPreferenceDraft, sanitizeSearchPreferenceDraft } = loadSearchPreferenceModule();
const TODAY = "2026-11-16";

function tripDurationDays(start, end) {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
}

test("mixed flight, stay and dining prompt retains route, geography, dates, travelers and total budget", () => {
  const prompt = "nonstop round-trip flight from JFK to STI for 2 adults from Dec 26 to Dec 28 2026, an entire beachfront Airbnb in Las Terrenas Dominican Republic, restaurants and things to do, budget of $2,500 total";
  const draft = parseDeterministicSearchPreferenceDraft(prompt, TODAY);

  assert.equal(draft.originAirportCode, "JFK");
  assert.equal(draft.destinationAirportCode, "STI");
  assert.equal(draft.destination, "Dominican Republic");
  assert.equal(draft.destinationArea, "Las Terrenas");
  assert.equal(draft.departureDate, "2026-12-26");
  assert.equal(draft.returnDate, "2026-12-28");
  assert.equal(tripDurationDays(draft.departureDate, draft.returnDate), 2);
  assert.equal(draft.adults, 2);
  assert.equal(draft.budget, 2500);
  assert.equal(draft.budgetMode, "total");
  assert.deepEqual(draft.components, ["stays", "flights", "activities"]);
  assert.deepEqual(draft.stayTypes, ["vacation_rentals"]);
  assert.equal(draft.staySpaceType, "entire_place");
  assert.ok(draft.mustHaveAmenities.includes("beach_access"));
  assert.equal(draft.stops, "nonstop");
  assert.ok(!draft.notes?.some((note) => /no year was specified/i.test(note)), "an explicit year on either endpoint should anchor the range");
});

test("flight constraints do not consume the budget amount and route preferences remain separate", () => {
  const prompt = "Fly from Newark to Tirana Albania on Dec 10 and return Dec 15 2026, for 4 people, premium economy, maximum of 1 stop. Avoid connections through Canada and prefer connections through Jamaica. Hotel and activities, total budget $4,000.";
  const draft = parseDeterministicSearchPreferenceDraft(prompt, TODAY);

  assert.equal(draft.originAirportCode, "EWR");
  assert.equal(draft.destinationAirportCode, "TIA");
  assert.equal(draft.destination, "Albania");
  assert.equal(draft.destinationArea, "Tirana");
  assert.equal(draft.departureDate, "2026-12-10");
  assert.equal(draft.returnDate, "2026-12-15");
  assert.equal(draft.adults, 4);
  assert.equal(draft.cabinClass, "premium_economy");
  assert.equal(draft.stops, "one_stop");
  assert.equal(draft.budget, 4000);
  assert.equal(draft.budgetMode, "total");
  assert.deepEqual(draft.preferredLayoverCountries, ["Jamaica"]);
  assert.deepEqual(draft.avoidLayoverCountries, ["Canada"]);
});

test("lodging-only date ranges are not mistaken for airport routes and explicit no-flight intent is respected", () => {
  const prompt = "Find a whole house in the Poconos Pennsylvania from Dec 20 to Dec 23 2026 for 8 adults, budget $2k per person, full kitchen and private hot tub, no flights, stays and things to do.";
  const draft = parseDeterministicSearchPreferenceDraft(prompt, TODAY);

  assert.equal(draft.destination, "Pennsylvania");
  assert.equal(draft.destinationArea, "Poconos");
  assert.equal(draft.departureDate, "2026-12-20");
  assert.equal(draft.returnDate, "2026-12-23");
  assert.equal(draft.origin, undefined);
  assert.equal(draft.originAirportCode, undefined);
  assert.equal(draft.destinationAirportCode, undefined);
  assert.equal(draft.adults, 8);
  assert.equal(draft.budget, 2000);
  assert.equal(draft.budgetMode, "per_person");
  assert.deepEqual(draft.components, ["activities", "stays"]);
  assert.deepEqual(draft.stayTypes, ["vacation_rentals"]);
  assert.equal(draft.staySpaceType, "entire_place");
  assert.ok(draft.mustHaveAmenities.includes("kitchen"));
  assert.ok(draft.mustHaveAmenities.includes("hot_tub"));
  assert.ok(!draft.components.includes("flights"));
});

test("beach wording does not turn a whole-trip budget into a per-person budget", () => {
  const prompt = "A beachfront rental near the beach in Punta Cana for 2 people, Dec 10 to Dec 15 2026, budget $2,500 total.";
  const draft = parseDeterministicSearchPreferenceDraft(prompt, TODAY);
  assert.equal(draft.budget, 2500);
  assert.equal(draft.budgetMode, "total");
});

test("model drafts remain allowlisted and retain explicit route and date constraints", () => {
  const prompt = "flight from JFK to STI for 2 people Dec 26 to Dec 28 2026";
  const draft = sanitizeSearchPreferenceDraft({
    originAirportCode: "JFK",
    destinationAirportCode: "STI",
    departureDate: "2026-12-26",
    returnDate: "2026-12-28",
    adults: 2,
    destination: "Dominican Republic",
    destinationArea: "Las Terrenas",
    budget: 2500,
    components: ["flights", "stays", "unexpected-admin-action"],
    admin: true,
  }, TODAY, prompt);

  assert.equal(draft.originAirportCode, "JFK");
  assert.equal(draft.destinationAirportCode, "STI");
  assert.equal(draft.departureDate, "2026-12-26");
  assert.equal(draft.returnDate, "2026-12-28");
  assert.deepEqual(draft.components, ["flights", "stays"]);
  assert.equal("admin" in draft, false);
});

test("review/apply confirmation maps parsed fields into the form and initial search URL", () => {
  const component = read("components/trip-search.tsx");
  assert.match(component, /setPreferenceDraft\(payload\.draft\)/);
  assert.match(component, /onClick=\{applyParsedPreferences\}/);

  const applyStart = component.indexOf("function applyParsedPreferences()");
  const applyEnd = component.indexOf("const parsedPreferenceSummary", applyStart);
  assert.ok(applyStart >= 0 && applyEnd > applyStart);
  const applyFlow = component.slice(applyStart, applyEnd);
  for (const field of [
    "originAirportCode", "destinationAirportCode", "departureDate", "returnDate", "adults", "budget", "budgetMode", "currency",
    "components", "stayTypes", "staySpaceType", "mustHaveAmenities", "cabinClass", "stops", "preferredLayoverCountries", "avoidLayoverCountries",
  ]) assert.ok(applyFlow.includes(`draft.${field}`), `confirmation flow must apply ${field}`);

  const submitStart = component.indexOf("const params = new URLSearchParams(");
  const submitEnd = component.indexOf("router.push(`/results?", submitStart);
  assert.ok(submitStart >= 0 && submitEnd > submitStart);
  const initialSearch = component.slice(submitStart, submitEnd);
  for (const key of [
    "originAirportCode", "destinationAirportCode", "depart", "return", "adults", "budget", "budgetMode", "currency", "components",
    "stayTypes", "staySpaceType", "stayMust", "cabin", "stops", "preferLayovers", "avoidLayovers",
  ]) assert.ok(initialSearch.includes(key), `initial search URL must serialize ${key}`);
});

test("parse API merges deterministic route and constraint fields over partial model output", () => {
  const route = read("app/api/ai/parse-search/route.ts");
  assert.match(route, /parseDeterministicSearchPreferenceDraft\(description, todayLocal\)/);
  assert.match(route, /sanitizeSearchPreferenceDraft\(\{ \.\.\.raw, \.\.\.localDraft \}, todayLocal, description\)/);
  assert.match(route, /if \(hasLocalDraft && isShortHighConfidenceRequest\) return sendLocalDraft\("direct"\)/);
});
