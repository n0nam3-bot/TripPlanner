const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  classifyWeatherDate,
  normalizeVisualCrossingDay,
  normalizeVisualCrossingRange,
} = require("../../.test-build/lib/trip-planner/weather.js");

const today = new Date("2026-11-17T12:00:00.000Z");

test("Visual Crossing days within Today+15 are explicitly model forecasts", () => {
  assert.equal(classifyWeatherDate("2026-12-02", today), "forecast");
  assert.equal(classifyWeatherDate("2026-12-03", today), "seasonal_estimate");
});

test("Visual Crossing long-range daily values are labeled seasonal estimates with normalized units", () => {
  const day = normalizeVisualCrossingDay({
    datetime: "2026-12-26", conditions: "Partially cloudy", tempmax: 81, tempmin: 69,
    precipprob: 6, windspeed: 7, uvindex: 5,
  }, "2026-12-26", today);
  assert.ok(day);
  assert.equal(day.source, "Visual Crossing");
  assert.equal(day.forecastType, "seasonal_estimate");
  assert.equal(day.highF, 81);
  assert.equal(day.lowF, 69);
  assert.ok(Math.abs(day.maxWindKph - 11.265408) < 0.001);
});

test("Visual Crossing single-range cache format is reusable and ordered by requested dates", () => {
  const cached = [
    { date: "2026-12-27", condition: "Clear", highF: 80, lowF: 68, highC: 26.7, lowC: 20, rainChance: 0, maxWindKph: 10, uv: 5, icon: "", forecastType: "seasonal_estimate", source: "Visual Crossing" },
    { date: "2026-12-26", condition: "Cloudy", highF: 79, lowF: 67, highC: 26.1, lowC: 19.4, rainChance: 10, maxWindKph: 12, uv: 4, icon: "", forecastType: "seasonal_estimate", source: "Visual Crossing" },
  ];
  const result = normalizeVisualCrossingRange(cached, ["2026-12-26", "2026-12-27"], today);
  assert.deepEqual(result.map((day) => day.date), ["2026-12-26", "2026-12-27"]);
  assert.ok(result.every((day) => day.forecastType === "seasonal_estimate"));
});

test("weather route uses one Visual Crossing date-range request, optional key, 12-hour Neon cache and graceful 429 handling", () => {
  const route = fs.readFileSync(path.join(__dirname, "../../app/api/travel/weather/route.ts"), "utf8");
  assert.match(route, /timeline\/\$\{encodeURIComponent\(location\)\}\/\$\{startDate\}\/\$\{endDate\}/);
  assert.match(route, /process\.env\.VISUALCROSSING_API_KEY/);
  assert.match(route, /12 \* 3600/);
  assert.match(route, /response\.status === 429/);
  assert.match(route, /Today\+15|15-day model forecast window/);
  assert.match(route, /seasonal estimates/i);
  assert.match(route, /https:\/\/www\.visualcrossing\.com\//);
  const workspace = fs.readFileSync(path.join(__dirname, "../../components/trips/results-workspace.tsx"), "utf8");
  assert.match(workspace, /Seasonal estimate/);
  assert.match(workspace, /Weather data provided by <a href=\{item\.url\}/);
  assert.match(workspace, /day\.source/);
  assert.match(route, /freshCachedDays\.length === requestedDates\.length/);
  assert.match(route, /normalizeVisualCrossingRange\(fallbackCache\?\.payload\.days, requestedDates\)/);
});
