const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('shared header keeps Tripfinder branding first and replaces Discover with Support', () => {
  const header = read('components/site-header.tsx');
  assert.match(header, /<Brand\s*\/>/);
  assert.match(header, /<SupportTipLink\s+compact\s*\/>/);
  assert.match(header, /Plan a trip/);
  assert.doesNotMatch(header, /Discover/);
});

test('compact support action reuses the safe configured tip URL and accessible label', () => {
  const support = read('components/support-tip-link.tsx');
  assert.match(support, /export function SupportTipLink\(\{ compact = false \}/);
  assert.match(support, /className="support-project-link support-project-link-compact"/);
  assert.match(support, /target="_blank"/);
  assert.match(support, /rel="noopener noreferrer nofollow"/);
  assert.match(support, /aria-label="Support Tripfinder with an optional tip/);
  assert.match(support, /new URL\(configuredUrl\)/);
});

test('results footer uses the new Tripfinder tagline and preserves New Search', () => {
  const results = read('app/results/page.tsx');
  assert.match(results, /Make room for somewhere new\./);
  assert.doesNotMatch(results, /Plan the whole trip in one place/);
  assert.match(results, /New search/);
});

test('shared header stays pinned and results footer reserves assistant space', () => {
  const css = read('app/globals.css');
  assert.match(css, /\.site-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*1100;/s);
  assert.match(css, /\.results-page:has\(\.trip-ai-dock\.is-expanded\) \.results-footer/);
  assert.match(css, /padding-right:\s*360px/);
  assert.match(css, /\.results-page:has\(\.trip-ai-dock\.is-minimized\) \.results-footer/);
});
