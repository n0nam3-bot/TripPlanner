const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const {
  parseProximityRequirement,
  parseRouteDurationMinutes,
  milesForProximityLimit,
} = require("../../.test-build/lib/trip-planner/proximity-filter.js");

const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("restaurant minute limits are parsed as driving limits unless walking is explicitly requested", () => {
  assert.deepEqual(parseProximityRequirement(["Restaurant proximity: within 5 minutes from the Airbnb"], "restaurant"), {
    kind: "time", amount: 5, unit: "minutes", mode: "drive", raw: "within 5 minutes from the Airbnb",
  });
  assert.equal(parseProximityRequirement(["Restaurant proximity: no more than 8 mins walking"], "restaurant").mode, "walk");
});

test("distance limits support miles and kilometers without triggering route requests", () => {
  assert.deepEqual(parseProximityRequirement(["Restaurant proximity: within 2 miles of stay"], "restaurant"), {
    kind: "distance", amount: 2, unit: "mi", raw: "within 2 miles of stay",
  });
  assert.equal(milesForProximityLimit(5, "km"), 5 / 1.609344);
});

test("vague nearby notes are not converted into invented numerical limits", () => {
  assert.equal(parseProximityRequirement(["Restaurant proximity: near the property"], "restaurant"), null);
  assert.equal(parseProximityRequirement(["Activity proximity: nearby"], "activity"), null);
});

test("route durations round up so a route just over the threshold cannot pass", () => {
  assert.equal(parseRouteDurationMinutes("5 min 1 sec"), 6);
  assert.equal(parseRouteDurationMinutes("1 hr 4 min"), 64);
  assert.equal(parseRouteDurationMinutes("", 300), 5);
  assert.equal(parseRouteDurationMinutes("unknown"), null);
});

test("results workspace offers clearly separated in-range, out-of-range and unverified groups", () => {
  const source = read("components/trips/results-workspace.tsx");
  assert.match(source, /Within requested limit/);
  assert.match(source, /Outside requested limit/);
  assert.match(source, /Not verified/);
  assert.match(source, /No restaurant or activity is labeled as meeting the requested driving time until its route has been checked/);
  assert.match(source, /\.slice\(0, 8\)/);
});

test("route verification uses Geoapify coordinates and skips static-map image credits", () => {
  const workspace = read("components/trips/results-workspace.tsx");
  const api = read("app/api/travel/directions/route.ts");
  const provider = read("lib/providers/geoapify.ts");
  assert.match(workspace, /proximityCheck: true/);
  assert.match(workspace, /includeMapPreview: false/);
  assert.match(api, /proximityCheck && \(!originCoordinates \|\| !destinationCoordinates \|\| !process\.env\.GEOAPIFY_API_KEY/);
  assert.match(provider, /input\.includeMapPreview !== false/);
});

test("route limits do not claim walking-time verification while only driving routes are supported", () => {
  const source = read("components/trips/results-workspace.tsx");
  assert.match(source, /Walking-route verification is not yet supported/);
  assert.match(source, /Walking route verification is not available/);
});

test("updated ResultsWorkspace TSX parses successfully", () => {
  const result = ts.transpileModule(read("components/trips/results-workspace.tsx"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
});
