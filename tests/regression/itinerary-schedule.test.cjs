const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../components/trips/results-workspace.tsx"), "utf8");

test("selected activities and restaurants can be rescheduled from the unified trip schedule", () => {
  assert.match(source, /label className="itinerary-date-select"><span>Scheduled date<\/span><select value={plan\.date}/);
  assert.match(source, /onUpdateExperience\(experience, \{ \.\.\.plan, date: event\.target\.value \}\)/);
  assert.match(source, /days\.map\(\(day\) => <option value={day\.date}/);
  assert.match(source, /days={itineraryDates}/);
});

test("changing the planned date retains the selected time and time-of-day slot", () => {
  assert.match(source, /onUpdateExperience\(experience, \{ \.\.\.plan, date: event\.target\.value \}\)/);
  assert.match(source, /onUpdateExperience\(experience, \{ \.\.\.plan, time: event\.target\.value \|\| undefined \}\)/);
  assert.match(source, /const orderTime = plan\.time \|\| defaultSlotTime\[plan\.slot\]/);
});
