const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function assertTsxParses(relative) {
  const result = ts.transpileModule(read(relative), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
}

function loadSearchPreferenceParser() {
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
      return { resolveAirportCode: (value) => {
        const normalized = String(value).trim().toUpperCase();
        if (/^[A-Z]{3}$/.test(normalized)) return normalized;
        if (normalized === "LAS TERRENAS") return "AZS";
        return null;
      } };
    }
    return nativeRequire.call(this, request);
  };
  compiled._compile(javascript, filename);
  return compiled.exports.parseDeterministicSearchPreferenceDraft;
}

test("WeatherAPI plan limits and missing keys can fall back to Visual Crossing without requiring a key", () => {
  const route = read("app/api/travel/weather/route.ts");
  assert.match(route, /fetchVisualCrossingRange/);
  assert.match(route, /weather\.visualcrossing\.com\/VisualCrossingWebServices\/rest\/services\/timeline/);
  assert.match(route, /const optionalKey = process\.env\.VISUALCROSSING_API_KEY\?\.trim\(\)/);
  assert.match(route, /if \(optionalKey\) url\.searchParams\.set\("key", optionalKey\)/);
  assert.doesNotMatch(route, /if \(!optionalKey\)\s*throw/);
  assert.match(route, /primaryFailure = "WeatherAPI is not configured; using the backup weather source\."/);
});

test("weather fallback labels forecast versus statistical outlook beyond 15 days", () => {
  const route = read("app/api/travel/weather/route.ts");
  assert.match(route, /basis: utcDayOffset\(asString\(item\.datetime\) \|\| requestedDate\) <= 15 \? "forecast" : "seasonal"/);
  assert.match(route, /statistical seasonal outlooks based on historical weather patterns, not precise day-specific forecasts/);
  assert.match(route, /source: "Visual Crossing"/);
  assert.match(route, /maxWindKph: windMph === null \? null : Math\.round\(windMph \* 1\.609344/);
});

test("weather fallback is cached by location and date and requests a single missing-date range", () => {
  const route = read("app/api/travel/weather/route.ts");
  assert.match(route, /"weatherapi-v2" \| "visualcrossing-v1"/);
  assert.match(route, /writeCachedDay\("visualcrossing-v1", location, day, "timeline-days", 12 \* 3600\)/);
  assert.match(route, /fetchVisualCrossingRange\(location, missingDates\[0\], missingDates\[missingDates\.length - 1\]\)/);
  assert.match(route, /include", "days,statsfcst"/);
  assert.match(route, /Weather cache is an optimization, not a dependency/);
  assert.match(route, /elements", "datetime,tempmax,tempmin,conditions,icon,precipprob,windspeed,uvindex,description"/);
});

test("WeatherPanel automatically loads without a WeatherAPI key and displays attribution and seasonal labels", () => {
  const workspace = read("components/trips/results-workspace.tsx");
  const page = read("app/results/page.tsx");
  assert.match(workspace, /attemptedFor\.current !== requestKey/);
  assert.match(workspace, /WeatherPanel location=\{destinationLabel\} startDate=\{search\.departureDate\} endDate=\{search\.returnDate\}\/>/);
  assert.match(workspace, /weather-basis-label">Seasonal estimate/);
  assert.match(workspace, /weather-attribution/);
  assert.doesNotMatch(workspace, /weatherKeyConfigured/);
  assert.doesNotMatch(page, /weatherKeyConfigured/);
});

test("WeatherAPI low temperature is normalized from mintemp_f instead of max temperature", () => {
  const route = read("app/api/travel/weather/route.ts");
  assert.match(route, /lowF: asNumber\(day\.mintemp_f\)/);
});

test("confirmed search-object arrival airport takes precedence over destination defaults", () => {
  const route = read("app/api/travel/search/route.ts");
  assert.match(route, /const searchAirportCode = typeof validated\.input\.destinationAirportCode === "string" \? validated\.input\.destinationAirportCode\.trim\(\)\.toUpperCase\(\) : ""/);
  assert.match(route, /const airportCode = searchAirportCode \|\| suppliedAirportCode \|\| inferredCityAirport/);
  assert.match(route, /const searchInput = \{ \.\.\.validated\.input, destinationAirportCode: airportCode \}/);
  assert.match(route, /searchLiveTravel\(searchInput, airportCode/);
});

test("flight no-results state exposes the actual airport pair and exact dates", () => {
  const workspace = read("components/trips/results-workspace.tsx");
  assert.match(workspace, /Search route: <strong>\{originCode\.toUpperCase\(\)\} → \{arrivalCode\.toUpperCase\(\)\}<\/strong>/);
  assert.match(workspace, /No flight options were returned for <strong>\{originCode\.toUpperCase\(\)\} → \{arrivalCode\.toUpperCase\(\)\}<\/strong>/);
  assert.match(workspace, /Search this exact route on Google Flights/);
});

test("deterministic parser preserves explicit JFK-to-STI route while finding Las Terrenas after Airbnb wording", () => {
  const parser = read("lib/ai/search-preferences.ts");
  assert.match(parser, /const destinationSearchText = source/);
  assert.match(parser, /const routeCodes = source\.match\(\/\\bfrom\\s\+\(\[a-z\]\{3\}\)\\s\+to\\s\+\(\[a-z\]\{3\}\)\\b\/i\)/);
  assert.match(parser, /destination: "Dominican Republic", destinationArea: "Las Terrenas"/);
  assert.match(parser, /destinationAirportCode=STI/);
});

test("the exact JFK-to-STI and Las Terrenas prompt preserves route, party, dates and a $2.5k total budget", () => {
  const parseDraft = loadSearchPreferenceParser();
  const prompt = "flight from jfk to sti with an airbnb beachfront in las terrenas dominican republic for 2 people from 12/26 to 12/28. restaurants near the airbnb and budget is 2.5k";
  const draft = parseDraft(prompt, "2026-11-16");
  assert.equal(draft.originAirportCode, "JFK");
  assert.equal(draft.destinationAirportCode, "STI");
  assert.equal(draft.destination, "Dominican Republic");
  assert.equal(draft.destinationArea, "Las Terrenas");
  assert.equal(draft.departureDate, "2026-12-26");
  assert.equal(draft.returnDate, "2026-12-28");
  assert.equal(draft.adults, 2);
  assert.equal(draft.budget, 2500);
  assert.equal(draft.budgetMode, "total");
  assert.deepEqual(draft.components, ["stays", "flights", "activities"]);

  const perPerson = parseDraft("budget is $1,200 per person for a beach weekend", "2026-11-16");
  assert.equal(perPerson.budget, 1200);
  assert.equal(perPerson.budgetMode, "per_person");
});

test("applying a partial parser result does not reset an unchanged explicit airport selection", () => {
  const component = read("components/trip-search.tsx");
  assert.match(component, /const destinationScopeChanged = nextDestination/);
  assert.match(component, /else if \(destinationScopeChanged\) setDestinationAirportCode/);
  assert.doesNotMatch(component, /else if \(draft\.destination \|\| draft\.destinationArea\) setDestinationAirportCode/);
});

test("AI assistant Props accepts the starting-point callback passed by ResultsWorkspace", () => {
  const assistant = read("components/trips/ai-trip-assistant.tsx");
  const workspace = read("components/trips/results-workspace.tsx");
  assert.match(assistant, /onSetStartingPoint\?: \(location: string\) => void \| Promise<void>/);
  assert.match(workspace, /onSetStartingPoint=\{\(location\) => resolveStartingPoint/);
});

test("changed weather, parser, search and assistant TSX files parse", () => {
  for (const file of [
    "app/api/travel/weather/route.ts",
    "app/api/travel/search/route.ts",
    "app/api/ai/parse-search/route.ts",
    "components/trips/results-workspace.tsx",
    "components/trips/ai-trip-assistant.tsx",
    "components/trip-search.tsx",
    "app/results/page.tsx",
  ]) assertTsxParses(file);
});
