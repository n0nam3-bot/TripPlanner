const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createAnonymousVisitorId, hashAnonymousVisitorId, isValidAnonymousVisitorId, ANONYMOUS_VISITOR_COOKIE, ANONYMOUS_VISITOR_COOKIE_MAX_AGE } = require("../../.test-build/lib/trip-planner/anonymous-visitor.js");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");


test("isolated Node crypto shim preserves both digest overloads required by production TypeScript", () => {
  const shim = read("tests/types/process-shim.d.ts");
  assert.match(shim, /digest\(\): Uint8Array/);
  assert.match(shim, /digest\(encoding: string\): string/);
});

test("anonymous visitor IDs are random, URL-safe, persistent-cookie compatible and never stored raw", () => {
  const first = createAnonymousVisitorId();
  const second = createAnonymousVisitorId();
  assert.ok(isValidAnonymousVisitorId(first));
  assert.ok(isValidAnonymousVisitorId(second));
  assert.notEqual(first, second);
  assert.equal(hashAnonymousVisitorId(first).length, 64);
  assert.notEqual(hashAnonymousVisitorId(first), hashAnonymousVisitorId(second));
  assert.equal(isValidAnonymousVisitorId("short"), false);
  assert.equal(isValidAnonymousVisitorId("x".repeat(43) + "!"), false);
  assert.equal(ANONYMOUS_VISITOR_COOKIE, "tf_visitor");
  assert.equal(ANONYMOUS_VISITOR_COOKIE_MAX_AGE, 31536000);
});

test("saved-trip save route sets a one-year HttpOnly SameSite cookie without exposing its ID", () => {
  const route = read("app/api/trips/route.ts");
  assert.match(route, /request\.cookies\.get\(ANONYMOUS_VISITOR_COOKIE\)/);
  assert.match(route, /httpOnly: true/);
  assert.match(route, /sameSite: "lax"/);
  assert.match(route, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(route, /response\.cookies\.set\(ANONYMOUS_VISITOR_COOKIE/);
  assert.doesNotMatch(route, /visitorId:\s*visitorId\s*,\s*shareToken/);
});

test("failed saved-trip insert is covered by the same quota reservation SQL statement", () => {
  const db = read("lib/db/saved-trips.ts");
  const saveBlock = db.slice(db.indexOf("const rows = await sql`WITH lock_keys AS MATERIALIZED"), db.indexOf("await sql`DELETE FROM tripfinder_saved_trips WHERE expires_at < now()`"));
  assert.match(saveBlock, /visitor_reserved AS/);
  assert.match(saveBlock, /ip_reserved AS/);
  assert.match(saveBlock, /created AS \(/);
  assert.match(saveBlock, /FROM visitor_reserved CROSS JOIN ip_reserved/);
  assert.match(saveBlock, /SELECT\s+usage_counts\.visitor_count/);
  assert.match(db, /SAVED_TRIP_SAVE_FAILED/);
});
