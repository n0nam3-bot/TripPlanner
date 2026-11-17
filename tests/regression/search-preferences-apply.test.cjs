const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../components/trip-search.tsx"), "utf8");

test("Apply to search carries the parsed arrival airport, exact dates, budget, style and Airbnb requirements into the form", () => {
  const start = source.indexOf("function applyParsedPreferences()");
  const end = source.indexOf("const parsedPreferenceSummary", start);
  assert.ok(start >= 0 && end > start);
  const apply = source.slice(start, end);
  for (const fragment of [
    "setPlanningNotes(draft.notes || [])",
    "setDestinationAirportCode(draft.destinationAirportCode)",
    "setDepart(draft.departureDate)",
    "setReturnDate(draft.returnDate)",
    "setAdults(String(draft.adults))",
    "setBudget(String(draft.budget))",
    "setBudgetMode(draft.budgetMode)",
    "setStyle(draft.tripStyle)",
    "setStayTypes(draft.stayTypes)",
    "setStayMustHaveAmenities(draft.mustHaveAmenities)",
  ]) assert.ok(apply.includes(fragment), `Apply to search should preserve ${fragment}`);
});

test("romantic preference and Airbnb proximity note are visible in the interpreted-preferences review", () => {
  assert.match(source, /preferenceDraft\.tripStyle && preferenceDraft\.tripStyle !== "any" \? `Trip style: \$\{preferenceDraft\.tripStyle\}`/);
  assert.match(source, /Restaurant proximity:/);
});
