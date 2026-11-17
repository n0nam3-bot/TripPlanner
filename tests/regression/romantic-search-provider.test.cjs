const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../lib/providers/serpapi.ts"), "utf8");

test("romantic trip style changes both activity and dining provider queries", () => {
  assert.match(source, /romantic: "romantic activities and experiences, sunset cruises, private boat tours, couples spa experiences/);
  assert.match(source, /const restaurantQuery = input\.style === "romantic"/);
  assert.match(source, /romantic restaurants, intimate date-night dining, waterfront restaurants/);
});
