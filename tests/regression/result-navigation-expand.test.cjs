const test = require("node:test");
const assert = require("node:assert/strict");
const { expandCollapsedResultAncestors } = require("../../.test-build/lib/ai/result-navigation.js");

function node(tagName, parentElement = null, open) {
  return { tagName: tagName.toUpperCase(), parentElement, ...(open === undefined ? {} : { open }) };
}

test("View in results opens a collapsed category section before navigating to its card", () => {
  const destination = node("article");
  const category = node("details", destination, false);
  const nestedGroup = node("details", category, false);
  const card = node("article", nestedGroup);

  const expanded = expandCollapsedResultAncestors(card);

  assert.equal(expanded, 2);
  assert.equal(category.open, true);
  assert.equal(nestedGroup.open, true);
});

test("navigation preserves sections that are already open", () => {
  const outer = node("details", null, true);
  const collapsed = node("details", outer, false);
  const card = node("article", collapsed);

  const expanded = expandCollapsedResultAncestors(card);

  assert.equal(expanded, 1);
  assert.equal(outer.open, true);
  assert.equal(collapsed.open, true);
});

test("navigation does not change unrelated collapsed sections", () => {
  const unrelated = node("details", null, false);
  const destination = node("article");
  const category = node("details", destination, false);
  const card = node("article", category);

  expandCollapsedResultAncestors(card);

  assert.equal(category.open, true);
  assert.equal(unrelated.open, false);
});

test("navigation is safe when the result is not inside a details section", () => {
  const wrapper = node("div");
  const card = node("article", wrapper);
  assert.equal(expandCollapsedResultAncestors(card), 0);
});
