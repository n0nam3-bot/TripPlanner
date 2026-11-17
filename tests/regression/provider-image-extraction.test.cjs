const test = require('node:test');
const assert = require('node:assert/strict');
const { firstProviderImage } = require('../../.test-build/lib/trip-planner/provider-images.js');

test('uses the first URL in Google Maps images array', () => {
  assert.equal(
    firstProviderImage(['https://lh3.googleusercontent.com/photo-a', 'https://lh3.googleusercontent.com/photo-b']),
    'https://lh3.googleusercontent.com/photo-a',
  );
});

test('uses larger Google Maps thumbnail when primary thumbnail is absent', () => {
  assert.equal(
    firstProviderImage({ thumbnail_large: 'https://example.com/large.jpg' }),
    'https://example.com/large.jpg',
  );
});

test('uses Google Hotels image object thumbnail and original image variants', () => {
  assert.equal(
    firstProviderImage([{ thumbnail: 'https://example.com/thumb.jpg', original_image: 'https://example.com/original.jpg' }]),
    'https://example.com/original.jpg',
  );
  assert.equal(
    firstProviderImage([{ original_image: 'https://example.com/original.jpg' }]),
    'https://example.com/original.jpg',
  );
});

test('skips invalid, insecure and credential-bearing URLs before the next valid image', () => {
  assert.equal(
    firstProviderImage(['http://example.com/insecure.jpg', 'javascript:alert(1)', 'https://user:pass@example.com/photo.jpg', 'https://example.com/valid.jpg']),
    'https://example.com/valid.jpg',
  );
});

test('returns undefined when the provider supplied no photo', () => {
  assert.equal(firstProviderImage(undefined, null, { title: 'No image' }), undefined);
});
