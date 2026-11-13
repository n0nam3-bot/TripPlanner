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

test("Your Trip date editor renders as a full-width panel outside the horizontal overview strip", () => {
  const workspace = fs.readFileSync(path.join(root, "components/trips/results-workspace.tsx"), "utf8");
  const sectionStart = workspace.indexOf('return <section className="results-trip-overview"');
  const sectionEnd = workspace.indexOf("function ResultsSectionNavigation", sectionStart);
  const overview = workspace.slice(sectionStart, sectionEnd);
  const listClose = overview.indexOf("</div>\n    {dateEditorOpen && <div className=\"results-overview-date-editor\"");
  const editorOpen = overview.indexOf('{dateEditorOpen && <div className="results-overview-date-editor"');
  assert.ok(sectionStart >= 0 && sectionEnd > sectionStart, "Your Trip overview component exists");
  assert.ok(listClose >= 0 && editorOpen > listClose, "date editor is a sibling below the horizontal list");
  assert.match(overview, /htmlFor="results-overview-start-date"[\s\S]*?type="date"/);
  assert.match(overview, /htmlFor="results-overview-end-date"[\s\S]*?type="date"/);
  assert.match(overview, />Cancel<\/button>[\s\S]*?>\{dateChangePending \? "Updating…" : "Update results"\}<\/button>/);
});

test("date editor controls remain full-width, readable, and tappable on narrow screens", () => {
  assert.match(css, /\.results-overview-date-editor\s*\{[^}]*width:\s*100%[^}]*box-sizing:\s*border-box/s);
  assert.match(css, /\.results-overview-date-editor input\[type="date"\]\s*\{[^}]*min-height:\s*44px[^}]*font-size:\s*13px/s);
  assert.match(css, /\.results-overview-date-actions button\s*\{[^}]*min-height:\s*44px[^}]*font-size:\s*12px/s);
  const narrow = css.split("@media (max-width: 400px)")[1] || "";
  assert.match(narrow, /\.results-overview-date-fields\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(narrow, /\.results-overview-date-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
});
