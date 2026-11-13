const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('My Trips page is linked from the global header and uses a browser-local saved-trip library', () => {
  const header = read('components/site-header.tsx');
  const page = read('app/my-trips/page.tsx');
  const client = read('components/trips/my-trips-client.tsx');
  assert.match(header, /href="\/my-trips"/);
  assert.match(page, /MyTripsClient/);
  assert.match(client, /tripfinder:saved-trip-owner:v1:/);
  assert.match(client, /localStorage\.key\(index\)/);
  assert.match(client, /url\.pathname !== "\/results"/);
  assert.match(client, /TOKEN_PATTERN\.test\(parsed\.ownerToken\)/);
});

test('My Trips offers direct saved-itinerary and owner feedback routes without putting owner credentials in URLs', () => {
  const client = read('components/trips/my-trips-client.tsx');
  assert.match(client, /\$\{trip\.searchPath\}#feedback/);
  assert.match(client, /`\/trip\/\$\{trip\.shareToken\}`/);
  assert.match(client, /Manage trip & feedback/);
  assert.doesNotMatch(client, /ownerToken\}`|ownerToken\}\//);
});

test('shared itinerary page detects the owner only in the originating browser', () => {
  const page = read('app/trip/[token]/page.tsx');
  const client = read('components/trips/my-trips-client.tsx');
  assert.match(page, /<OwnerTripAccess shareToken=\{token\}\s*\/>/);
  assert.match(client, /entry\.shareToken === shareToken/);
  assert.match(client, /Manage trip & feedback/);
  assert.match(client, /owner access is stored privately in this browser/);
});

test('managing a trip auto-opens the feedback inbox on the results workspace', () => {
  const workspace = read('components/trips/results-workspace.tsx');
  assert.match(workspace, /window\.location\.hash !== "#feedback"/);
  assert.match(workspace, /feedbackAutoOpenedRef\.current = true/);
  assert.match(workspace, /void loadTripFeedback\(\)/);
  assert.match(workspace, /id="feedback" className="results-feedback-section"/);
});

test('traveler feedback actions stay collapsed until requested so quick navigation retains space', () => {
  const workspace = read('components/trips/results-workspace.tsx');
  const css = read('app/globals.css');
  assert.match(workspace, /className="results-feedback-toggle"/);
  assert.match(workspace, /\{feedbackOpen && <div id="results-feedback-content"/);
  assert.match(workspace, /Invite a traveler/);
  assert.match(workspace, /Refresh inbox/);
  assert.match(css, /\.results-feedback-section/);
  assert.match(css, /\.results-feedback-invite-copy > a[^}]*text-overflow: ellipsis/s);
  assert.match(workspace, /<ResultsSectionNavigation sections=\{navigationSections\}/);
});
