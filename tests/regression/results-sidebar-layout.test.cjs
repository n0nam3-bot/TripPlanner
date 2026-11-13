const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const workspace = fs.readFileSync(path.join(root, 'components/trips/results-workspace.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

test('frozen overview keeps Copy link and Open link in separate compact columns', () => {
  assert.match(workspace, /aria-label="Copy share link"[^>]*>[\s\S]*?<span>Copy link<\/span>/);
  assert.match(workspace, /aria-label="Open share link"[^>]*>[\s\S]*?<span>Open link<\/span>/);
  const compact = css.split('/* Compact frozen trip controls')[1] || '';
  assert.match(compact, /\.results-overview-share-actions\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(compact, /\.results-overview-share-actions\s*>\s*button,\s*\.results-overview-share-actions\s*>\s*a\s*\{[^}]*min-height:\s*27px/s);
});

test('traveler feedback title and View inbox are distinct side-by-side buttons', () => {
  assert.match(workspace, /className="results-feedback-header"[\s\S]*?className="results-feedback-toggle"[\s\S]*?Traveler feedback[\s\S]*?className="results-feedback-view"[\s\S]*?View inbox/);
  assert.doesNotMatch(workspace, /className="results-feedback-toggle"[^>]*>[\s\S]*?<small>[\s\S]*?View inbox/);
  const compact = css.split('/* Compact frozen trip controls')[1] || '';
  assert.match(compact, /\.results-feedback-header\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1\.6fr\)\s+minmax\(0,\s*1fr\)/s);
  assert.match(compact, /\.results-feedback-view\s*\{[^}]*min-height:\s*32px/s);
});

test('short desktop viewports raise and compact the frozen overview while preserving quick navigation height', () => {
  const compact = css.split('/* Bring the pinned overview closer')[1] || '';
  assert.match(compact, /@media\s*\(min-width:\s*1280px\)\s*and\s*\(max-height:\s*860px\)/);
  assert.match(compact, /\.results-left-sidebar\s*\{[^}]*top:\s*88px[^}]*bottom:\s*9px/s);
  assert.match(compact, /\.results-trip-overview\s*\{[^}]*max-height:\s*62vh[^}]*overflow-y:\s*auto/s);
  assert.match(compact, /\.results-left-sidebar\s+\.results-section-rail\s*\{[^}]*min-height:\s*150px/s);
  assert.match(compact, /@media\s*\(min-width:\s*1280px\)\s*and\s*\(max-height:\s*720px\)/);
});
