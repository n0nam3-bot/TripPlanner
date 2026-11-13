const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const assistant = fs.readFileSync(path.join(root, "components/trips/ai-trip-assistant.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

test("AI assistant starts minimized in the shared initial render and expands automatically on wider screens", () => {
  assert.match(assistant, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(assistant, /matchMedia\("\(min-width: 641px\)"\)\.matches\) setOpen\(true\)/);
  assert.match(assistant, /!open && <button type="button" className="trip-ai-launcher"/);
});

test("mobile Your Trip overview remains a horizontal swipe strip with compact cards and inline save controls", () => {
  assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*?\.results-trip-overview-list\s*\{[^}]*scroll-snap-type:\s*x proximity/s);
  assert.match(css, /\.results-trip-overview-item\s*\{[^}]*min-width:\s*98px/s);
  assert.match(css, /\.results-trip-overview-save-actions\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.results-overview-share-actions\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.results-left-sidebar\s*\{[^}]*margin-bottom:\s*8px/s);
});

test("desktop results typography receives a separate larger type scale", () => {
  const desktop = css.split("/* Desktop readability pass")[1]?.split("/* Mobile: retain")[0] || "";
  assert.match(desktop, /@media \(min-width: 761px\)/);
  assert.match(desktop, /\.search-field input, \.search-field select \{ font-size: 14px; \}/);
  assert.match(desktop, /\.field-label \{ font-size: 10px; \}/);
  assert.match(desktop, /\.results-truth-note\s*\{[^}]*font-size:\s*14px/s);
  assert.match(desktop, /\.experience-copy p,[\s\S]*?font-size:\s*13px/s);
  assert.match(desktop, /\.results-trip-overview-item > strong\s*\{[^}]*font-size:\s*12px/s);
  assert.match(desktop, /\.results-left-sidebar \.results-section-rail-link\s*\{[^}]*font-size:\s*10px/s);
});
