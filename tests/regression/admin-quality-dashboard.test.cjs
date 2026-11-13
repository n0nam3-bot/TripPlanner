const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("admin quality view reports provider outcome history and stale fallbacks without full request data", () => {
  const db = read("lib/db/travel-cache.ts");
  const api = read("app/api/admin/overview/route.ts");
  const ui = read("app/admin/admin-dashboard.tsx");
  assert.match(api, /hasValidAdminSession\(request\)/);
  assert.match(db, /now\(\) - interval '7 days'/);
  assert.match(db, /AS attempts/);
  assert.match(db, /AS successes/);
  assert.match(db, /AS stale_fallbacks/);
  assert.match(db, /AS last_success_at/);
  assert.match(db, /AS last_failure_at/);
  assert.match(db, /AS active_shares/);
  assert.match(db, /AS visitor_saves_today/);
  assert.match(db, /AS ip_saves_today/);
  assert.match(ui, /Availability and stale-result signals/);
  assert.match(ui, /Sharing and quota activity/);
  assert.match(ui, /Event-based, not an uptime probe/);
  assert.doesNotMatch(db.slice(db.indexOf("providerHealth: (providerHealthRows"), db.indexOf("aiUsage:")), /search_text|booking_token|raw_ip/);
});

test("roadmap leaves click-through and end-to-end trip outcome tracking open", () => {
  const roadmap = read("docs/PRODUCT-ROADMAP.md");
  assert.match(roadmap, /\[x\] Extend the authenticated admin dashboard with 7-day provider outcome rates/);
  assert.match(roadmap, /\[ \] Add outbound-link click\/redirect-health monitoring and explicit end-to-end trip-search outcome tracking/);
});
