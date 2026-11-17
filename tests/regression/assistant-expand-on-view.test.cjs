const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const assistant = fs.readFileSync(path.join(__dirname, "../../components/trips/ai-trip-assistant.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(__dirname, "../../components/trips/results-workspace.tsx"), "utf8");

test("assistant delegates View in results to the results workspace", () => {
  assert.match(assistant, /onViewResult\?: \(anchor: string\) => void/);
  assert.match(assistant, /if \(onViewResult\) \{\s*onViewResult\(anchor\);/);
  assert.match(workspace, /onViewResult=\{\(anchor\) => revealAssistantResult\(assistantRecommendation\.destination\.id, anchor\)\}/);
});

test("View in results expands the destination and every collapsed details ancestor before scrolling", () => {
  const start = workspace.indexOf("function revealAssistantResult(");
  const end = workspace.indexOf("const navigationSections:", start);
  assert.ok(start >= 0 && end > start);
  const implementation = workspace.slice(start, end);
  assert.match(implementation, /setExpanded\(destinationId\)/);
  assert.match(implementation, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame/);
  assert.match(implementation, /ancestor instanceof HTMLDetailsElement\) ancestor\.open = true/);
  assert.ok(implementation.indexOf("ancestor.open = true") < implementation.indexOf("target.scrollIntoView"));
  assert.match(implementation, /target\.focus\(\{ preventScroll: true \}\)/);
});
