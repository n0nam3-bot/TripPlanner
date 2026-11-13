const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

test("Vercel telemetry is mounted in the root layout and uses stable package versions", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  const telemetry = fs.readFileSync(path.join(root, "app/analytics.tsx"), "utf8");
  assert.equal(pkg.dependencies["@vercel/analytics"], "^2.0.1");
  assert.equal(pkg.dependencies["@vercel/speed-insights"], "^2.1.0");
  assert.match(layout, /VercelTelemetry/);
  assert.match(telemetry, /<VercelAnalytics/);
  assert.match(telemetry, /<SpeedInsights/);
  assert.match(telemetry, /sampleRate=\{0\.25\}/);
});

test("Vercel telemetry drops admin and API paths and strips query strings", () => {
  const telemetry = fs.readFileSync(path.join(root, "app/analytics.tsx"), "utf8");
  assert.ok(telemetry.includes('parsed.pathname === "/admin"'));
  assert.ok(telemetry.includes('parsed.pathname.startsWith("/admin/")'));
  assert.ok(telemetry.includes('parsed.pathname === "/api"'));
  assert.ok(telemetry.includes('parsed.pathname.startsWith("/api/")'));
  assert.ok(telemetry.includes("${parsed.origin}${parsed.pathname}"));
  assert.doesNotMatch(telemetry, /searchParams\.toString\(\)/);
});
