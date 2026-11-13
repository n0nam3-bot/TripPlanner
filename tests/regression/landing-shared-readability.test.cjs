const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
const page = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
const sharedPage = fs.readFileSync(path.join(root, "app/trip/[token]/page.tsx"), "utf8");

const readability = css.split("/* Landing page and shared-trip readability pass.")[1] || "";

test("main landing page uses larger, readable body and helper text", () => {
  assert.match(page, /className="landing-hero shell"/);
  assert.match(readability, /\.landing-copy > p:not\(\.landing-note\)\s*\{[^}]*font-size:\s*17px/s);
  assert.match(readability, /\.landing-note\s*\{[^}]*font-size:\s*13px/s);
  assert.match(readability, /\.inspiration-feature-copy small[\s\S]*?font-size:\s*11px/s);
  assert.match(readability, /\.inspiration-option-copy strong\s*\{\s*font-size:\s*17px/s);
});

test("main trip search labels, controls, presets and field help meet legibility floor", () => {
  assert.match(readability, /\.field-label\s*\{[^}]*font-size:\s*12px/s);
  assert.match(readability, /\.search-field input,[\s\S]*?\.search-field select\s*\{\s*font-size:\s*15px/s);
  assert.match(readability, /\.search-presets button\s*\{[^}]*font-size:\s*13px/s);
  assert.match(readability, /\.component-option-copy small\s*\{[^}]*font-size:\s*13px/s);
});

test("shared trip overview, item details, links and notices use larger typography", () => {
  assert.match(sharedPage, /className="saved-trip-page"/);
  assert.match(readability, /\.saved-trip-overview > div > strong\s*\{[^}]*font-size:\s*14px/s);
  assert.match(readability, /\.saved-trip-notice p\s*\{[^}]*font-size:\s*13px/s);
  assert.match(readability, /\.saved-trip-item > p\s*\{[^}]*font-size:\s*14px/s);
  assert.match(readability, /\.saved-trip-item-links a\s*\{[^}]*font-size:\s*13px/s);
  assert.match(readability, /\.saved-trip-page \.eyebrow \{ color: #[0-9a-f]{6}; font-size: 12px;/i);
  assert.match(readability, /\.saved-trip-actions > span\s*\{[^}]*font-size:\s*13px/s);
});

test("mobile keeps the increased text readable while using a compact responsive layout", () => {
  const mobile = readability.split("@media (max-width: 680px)")[1] || "";
  assert.match(mobile, /\.landing-copy > p:not\(\.landing-note\)\s*\{[^}]*font-size:\s*16px/s);
  assert.match(mobile, /\.saved-trip-overview > div > strong\s*\{[^}]*font-size:\s*13px/s);
  assert.match(mobile, /\.saved-trip-item > p\s*\{[^}]*font-size:\s*13px/s);
});
